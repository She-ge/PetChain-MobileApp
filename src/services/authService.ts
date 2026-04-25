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

/** Minimal shape of an Axios error we care about — avoids hard dep on axios types at compile time */
interface AxiosLikeError {
  isAxiosError: true;
  response?: {
    status?: number;
    data?: { error?: { message?: string } };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Decode a JWT payload without verifying the signature.
 * Verification is the server's responsibility; we only need `exp` client-side.
 */
function decodeJwtPayload(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new AuthError('Malformed JWT', 'INVALID_TOKEN');
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
        throw new AuthError('Failed to decode JWT payload', 'INVALID_TOKEN');
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
    throw new AuthError('Failed to decode JWT payload', 'INVALID_TOKEN');
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const { exp } = decodeJwtPayload(token);
    // Add a 30-second buffer to account for clock skew
    return Date.now() / 1000 >= exp - 30;
  } catch {
    return true;
  }
}

// ─── API client (scoped to auth — no circular dep with interceptors) ──────────

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

/**
 * Authenticate with email + password.
 * Stores the JWT (and optional refresh token) securely on success.
 */
export async function login(email: string, password: string): Promise<AuthSession> {
  if (!email || !password) {
    throw new AuthError('Email and password are required', 'MISSING_CREDENTIALS');
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
    if (err instanceof AuthError) throw err;
    if (err instanceof Error && err.name === 'EncryptionError') {
      throw new AuthError('Unable to securely store your session', 'SECURE_STORAGE_ERROR');
    }
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosLikeError;
      const status = axiosErr.response?.status;
      if (status === 401) throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
      if (status === 429)
        throw new AuthError('Too many attempts, please try again later', 'RATE_LIMITED');
      const msg = axiosErr.response?.data?.error?.message;
      throw new AuthError(msg ?? 'Login failed', 'LOGIN_FAILED');
    }
    throw new AuthError('Network error during login', 'NETWORK_ERROR');
  }
}

export async function register(payload: RegisterRequest): Promise<AuthSession> {
  if (!payload.email || !payload.password || !payload.name) {
    throw new AuthError('Name, email, and password are required', 'MISSING_REGISTRATION_FIELDS');
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
    if (err instanceof Error && err.name === 'EncryptionError') {
      throw new AuthError('Unable to securely store your session', 'SECURE_STORAGE_ERROR');
    }
    if (axios.isAxiosError(err)) {
      const msg = (err as AxiosLikeError).response?.data?.error?.message;
      throw new AuthError(msg ?? 'Registration failed', 'REGISTRATION_FAILED');
    }
    throw new AuthError('Network error during registration', 'NETWORK_ERROR');
  }
}

/**
 * Clear all stored tokens and end the local session.
 */
export async function logout(): Promise<void> {
  try {
    // Best-effort server-side invalidation — don't block logout if it fails
    const token = await getToken();
    if (token) {
      await authClient
        .post(API_ENDPOINTS.AUTH_LOGOUT, null, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => {
          // Silently ignore — local cleanup always proceeds
        });
    }
  } finally {
    await clearSecureTokens();
  }
}

/**
 * Retrieve the stored access token, or null if none exists.
 */
export async function getToken(): Promise<string | null> {
  try {
    return await getSecureToken();
  } catch {
    return null;
  }
}

/**
 * Returns true if a non-expired access token is present in secure storage.
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  return !isTokenExpired(token);
}

/**
 * Exchange the stored refresh token for a new access token.
 * Updates secure storage with the new tokens on success.
 * Clears all tokens and throws if the refresh token is missing or rejected.
 */
export async function refreshToken(): Promise<string> {
  try {
    const storedRefresh = await getSecureRefreshToken();
    if (!storedRefresh) {
      await clearSecureTokens();
      throw new AuthError('No refresh token available — please log in again', 'NO_REFRESH_TOKEN');
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
    // Refresh token rejected — force re-login
    await clearSecureTokens();

    if (err instanceof AuthError) {
      throw err;
    }
    if (err instanceof Error && err.name === 'EncryptionError') {
      throw new AuthError('Unable to securely update your session', 'SECURE_STORAGE_ERROR');
    }

    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosLikeError;
      const status = axiosErr.response?.status;
      if (status === 401) {
        throw new AuthError('Session expired — please log in again', 'REFRESH_TOKEN_EXPIRED');
      }
      const msg = axiosErr.response?.data?.error?.message;
      throw new AuthError(msg ?? 'Token refresh failed', 'REFRESH_FAILED');
    }
    throw new AuthError('Network error during token refresh', 'NETWORK_ERROR');
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  if (!email) {
    throw new AuthError('Email is required', 'MISSING_EMAIL');
  }

  try {
    await authClient.post(API_ENDPOINTS.AUTH_FORGOT_PASSWORD, { email });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const msg = (err as AxiosLikeError).response?.data?.error?.message;
      throw new AuthError(msg ?? 'Password reset request failed', 'PASSWORD_RESET_REQUEST_FAILED');
    }
    throw new AuthError('Network error while requesting password reset', 'NETWORK_ERROR');
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token || !newPassword) {
    throw new AuthError('Reset token and new password are required', 'MISSING_RESET_INPUT');
  }

  try {
    await authClient.post(API_ENDPOINTS.AUTH_RESET_PASSWORD, {
      token,
      newPassword,
    });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const msg = (err as AxiosLikeError).response?.data?.error?.message;
      throw new AuthError(msg ?? 'Password reset failed', 'PASSWORD_RESET_FAILED');
    }
    throw new AuthError('Network error while resetting password', 'NETWORK_ERROR');
  }
}

export async function verifyEmail(token: string): Promise<void> {
  if (!token) {
    throw new AuthError('Verification token is required', 'MISSING_VERIFICATION_TOKEN');
  }

  try {
    await authClient.post(API_ENDPOINTS.AUTH_VERIFY_EMAIL, { token });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const msg = (err as AxiosLikeError).response?.data?.error?.message;
      throw new AuthError(msg ?? 'Email verification failed', 'EMAIL_VERIFICATION_FAILED');
    }
    throw new AuthError('Network error while verifying email', 'NETWORK_ERROR');
  }
}

export async function getSession(): Promise<StoredSession | null> {
  try {
    const session = await getSecureTokens();
    if (!session?.token) {
      return null;
    }

    return {
      token: session.token,
      refreshToken: session.refreshToken,
    };
  } catch {
    return null;
  }
}

export async function isBiometricAuthenticationAvailable(): Promise<boolean> {
  const { isAvailable } = await getBiometricAvailability();
  return isAvailable;
}

export async function isBiometricAuthenticationEnabled(): Promise<boolean> {
  return await isBiometricStorageEnabled();
}

export async function promptForBiometricSetup(): Promise<boolean> {
  return await enableBiometricStorage();
}

export async function disableBiometricAuthentication(): Promise<void> {
  await disableBiometricStorage();
}

export async function authenticateWithBiometrics(): Promise<StoredSession> {
  if (!(await isBiometricAuthenticationAvailable())) {
    throw new AuthError(
      'Biometric authentication is unavailable on this device. Please use your password.',
      'BIOMETRIC_UNAVAILABLE',
    );
  }

  if (!(await isBiometricAuthenticationEnabled())) {
    throw new AuthError(
      'Biometric authentication is not enabled. Please log in with your password.',
      'BIOMETRIC_NOT_ENABLED',
    );
  }

  const authenticated = await authenticateWithBiometricGate();
  if (!authenticated) {
    throw new AuthError(
      'Biometric authentication failed. Please continue with your password.',
      'BIOMETRIC_AUTH_FAILED',
    );
  }

  const session = await getSession();
  if (!session?.token) {
    throw new AuthError('No stored session available. Please log in again.', 'NO_STORED_SESSION');
  }

  return session;
}
