import axios, { AxiosInstance } from 'axios';
import * as Keychain from 'react-native-keychain';
import config from '../config';
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
} from '../../backend/types/api';
import { API_ENDPOINTS } from '../../backend/types/api';

// ─── Storage keys ────────────────────────────────────────────────────────────

const KEYCHAIN_SERVICE = 'com.petchain.auth';
const KEYCHAIN_USERNAME = 'petchain_user';

// Separate service label for the refresh token so both can coexist in keychain
const KEYCHAIN_REFRESH_SERVICE = 'com.petchain.auth.refresh';

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
  expiresIn: number;
}

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
    // Pure ES2020 base64url decode — no Buffer, no atob, works in Node and React Native.
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    // Decode base64 to bytes using a lookup table approach
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let bytes = '';
    let i = 0;
    while (i < padded.length) {
      const a = chars.indexOf(padded[i++]);
      const b = chars.indexOf(padded[i++]);
      const c = chars.indexOf(padded[i++]);
      const d = chars.indexOf(padded[i++]);
      bytes += String.fromCharCode(
        (a << 2) | (b >> 4),
        ((b & 15) << 4) | (c >> 2),
        ((c & 3) << 6) | d,
      );
    }
    // Strip null bytes added by padding
    const trimmed = bytes.replace(/\0+$/, '');
    // Decode UTF-8 bytes to string
    const raw = decodeURIComponent(
      Array.from(trimmed)
        .map((ch) => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
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

// ─── Secure storage helpers ───────────────────────────────────────────────────

async function storeToken(token: string): Promise<void> {
  await Keychain.setGenericPassword(KEYCHAIN_USERNAME, token, {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function storeRefreshToken(token: string): Promise<void> {
  await Keychain.setGenericPassword(KEYCHAIN_USERNAME, token, {
    service: KEYCHAIN_REFRESH_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function clearTokens(): Promise<void> {
  await Promise.allSettled([
    Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE }),
    Keychain.resetGenericPassword({ service: KEYCHAIN_REFRESH_SERVICE }),
  ]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Authenticate with email + password.
 * Stores the JWT (and optional refresh token) securely on success.
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthSession> {
  if (!email || !password) {
    throw new AuthError('Email and password are required', 'MISSING_CREDENTIALS');
  }

  try {
    const payload: LoginRequest = { email, password };
    const { data } = await authClient.post<LoginResponse>(
      API_ENDPOINTS.AUTH_LOGIN,
      payload,
    );

    await storeToken(data.token);
    if (data.refreshToken) {
      await storeRefreshToken(data.refreshToken);
    }

    return {
      user: data.user,
      token: data.token,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
    };
  } catch (err: unknown) {
    if (err instanceof AuthError) throw err;
    if (axios.isAxiosError(err)) {
      const axiosErr = err as AxiosLikeError;
      const status = axiosErr.response?.status;
      if (status === 401) throw new AuthError('Invalid credentials', 'INVALID_CREDENTIALS');
      if (status === 429) throw new AuthError('Too many attempts, please try again later', 'RATE_LIMITED');
      const msg = axiosErr.response?.data?.error?.message;
      throw new AuthError(msg ?? 'Login failed', 'LOGIN_FAILED');
    }
    throw new AuthError('Network error during login', 'NETWORK_ERROR');
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
    await clearTokens();
  }
}

/**
 * Retrieve the stored access token, or null if none exists.
 */
export async function getToken(): Promise<string | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });
    return credentials ? credentials.password : null;
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
  let storedRefresh: string | null = null;

  try {
    const credentials = await Keychain.getGenericPassword({
      service: KEYCHAIN_REFRESH_SERVICE,
    });
    storedRefresh = credentials ? credentials.password : null;
  } catch {
    storedRefresh = null;
  }

  if (!storedRefresh) {
    await clearTokens();
    throw new AuthError('No refresh token available — please log in again', 'NO_REFRESH_TOKEN');
  }

  try {
    const { data } = await authClient.post<RefreshTokenResponse>(
      API_ENDPOINTS.AUTH_REFRESH,
      { refreshToken: storedRefresh },
    );

    await storeToken(data.token);
    if (data.refreshToken) {
      await storeRefreshToken(data.refreshToken);
    }

    return data.token;
  } catch (err: unknown) {
    // Refresh token rejected — force re-login
    await clearTokens();

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
