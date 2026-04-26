import axios, { type AxiosInstance } from 'axios';

import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  RefreshTokenResponse,
} from '../../backend/types/api';
import { API_ENDPOINTS } from '../../backend/types/api';
import config from '../config';
import { logError } from '../utils/errorLogger';
import {
  authenticateWithBiometricGate,
  clearSecureTokens,
  disableBiometricAuthentication as disableBiometricStorage,
  enableBiometricAuthentication as enableBiometricStorage,
  getBiometricAvailability,
  getSecureRefreshToken,
  getSecureToken,
  getSecureTokens,
  isBiometricAuthenticationEnabled as isBiometricStorageEnabled,
  storeSecureTokens,
} from '../utils/encryption/keychain';

// ─── Custom error ─────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthSession {
  user: LoginResponse['user'];
  token: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface StoredSession {
  token: string;
  refreshToken?: string;
}

type OAuthProvider = 'google' | 'apple' | 'facebook';

const _OAUTH_ENDPOINTS: Record<OAuthProvider, string> = {
  google: '/auth/oauth/google',
  apple: '/auth/oauth/apple',
  facebook: '/auth/oauth/facebook',
} as const;

export const OAUTH_ENDPOINTS = _OAUTH_ENDPOINTS;

interface JwtPayload {
  sub: string;
  exp: number;
  iat: number;
  [key: string]: unknown;
}

interface AxiosLikeError {
  isAxiosError: true;
  response?: {
    status?: number;
    data?: { error?: { message?: string } };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    const error = new AuthError('Malformed JWT', 'INVALID_TOKEN');
    logError(error, { service: 'authService', action: 'decode_jwt' });
    throw error;
  }
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const bytes: number[] = [];
    for (let i = 0; i < padded.length; i += 4) {
      const c1 = chars.indexOf(padded[i]);
      const c2 = chars.indexOf(padded[i + 1]);
      const c3 = chars.indexOf(padded[i + 2]);
      const c4 = chars.indexOf(padded[i + 3]);
      if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) {
        const error = new AuthError('Failed to decode JWT payload', 'INVALID_TOKEN');
        logError(error, { service: 'authService', action: 'decode_jwt' });
        throw error;
      }
      const chunk = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);
      bytes.push((chunk >> 16) & 255);
      if (padded[i + 2] !== '=') bytes.push((chunk >> 8) & 255);
      if (padded[i + 3] !== '=') bytes.push(chunk & 255);
    }
    const raw = decodeURIComponent(
      bytes.map((b) => '%' + b.toString(16).padStart(2, '0')).join(''),
    );
    return JSON.parse(raw) as JwtPayload;
  } catch {
    const error = new AuthError('Failed to decode JWT payload', 'INVALID_TOKEN');
    logError(error, { service: 'authService', action: 'decode_jwt' });
    throw error;
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const { exp } = decodeJwtPayload(token);
    return Date.now() / 1000 >= exp - 30;
  } catch {
    return true;
  }
}

// ─── API client ───────────────────────────────────────────────────────────────

function createAuthClient(): AxiosInstance {
  return axios.create({
    baseURL: config.api.baseUrl,
    timeout: config.api.timeoutMs,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
}

const authClient = createAuthClient();

// ─── Public API ───────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthSession> {
  if (!email || !password) {
    const error = new AuthError('Email and password are required', 'MISSING_CREDENTIALS');
    logError(error, { service: 'authService', action: 'login_validation' });
    throw error;
  }

  try {
    const payload: LoginRequest = { email, password };
    const { data } = await authClient.post<LoginResponse>(API_ENDPOINTS.AUTH_LOGIN, payload);

    await storeSecureTokens({
      token: data.token,
      refreshToken: data.refreshToken,
    });

    return {
      user: data.user,
      token: data.token,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    };
  } catch (err: unknown) {
    if (err instanceof AuthError) {
      logError(err, { service: 'authService', action: 'login_auth_error' });
      throw err;
    }

    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosLikeError;
      const status = axiosErr.response?.status;

      logError(err as Error, {
        service: 'authService',
        action: 'login_request',
        email,
        status,
      });

      if (status === 401) throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
      if (status === 429)
        throw new AuthError('Too many attempts, please try again later', 'RATE_LIMITED');

      const msg = axiosErr.response?.data?.error?.message;
      throw new AuthError(msg ?? 'Login failed', 'LOGIN_FAILED');
    }

    logError(err as Error, { service: 'authService', action: 'login_unknown' });
    throw new AuthError('Network error during login', 'NETWORK_ERROR');
  }
}

export async function register(payload: RegisterRequest): Promise<AuthSession> {
  if (!payload.email || !payload.password || !payload.name) {
    const error = new AuthError('Missing registration fields', 'MISSING_REGISTRATION_FIELDS');
    logError(error, { service: 'authService', action: 'register_validation' });
    throw error;
  }

  try {
    const { data } = await authClient.post<RegisterResponse>(API_ENDPOINTS.AUTH_REGISTER, payload);

    await storeSecureTokens({
      token: data.token,
      refreshToken: data.refreshToken,
    });

    return {
      user: data.user,
      token: data.token,
      refreshToken: data.refreshToken,
    };
  } catch (err: unknown) {
    logError(err as Error, { service: 'authService', action: 'register' });

    if (axios.isAxiosError(err)) {
      const msg = (err as AxiosLikeError).response?.data?.error?.message;
      throw new AuthError(msg ?? 'Registration failed', 'REGISTRATION_FAILED');
    }

    throw new AuthError('Network error during registration', 'NETWORK_ERROR');
  }
}

export async function refreshToken(): Promise<string> {
  try {
    const storedRefresh = await getSecureRefreshToken();
    if (!storedRefresh) {
      await clearSecureTokens();
      const error = new AuthError('No refresh token available', 'NO_REFRESH_TOKEN');
      logError(error, { service: 'authService', action: 'refresh_missing_token' });
      throw error;
    }

    const { data } = await authClient.post<RefreshTokenResponse>(API_ENDPOINTS.AUTH_REFRESH, {
      refreshToken: storedRefresh,
    });

    await storeSecureTokens({
      token: data.token,
      refreshToken: data.refreshToken ?? storedRefresh,
    });

    return data.token;
  } catch (err: unknown) {
    await clearSecureTokens();

    logError(err as Error, { service: 'authService', action: 'refresh_token' });

    throw new AuthError('Token refresh failed', 'REFRESH_FAILED');
  }
}