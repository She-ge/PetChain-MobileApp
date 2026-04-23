/**
 * Unit tests for src/services/authService.ts
 *
 * All external dependencies (axios, react-native-keychain, config) are mocked
 * so these run cleanly in a Node/Jest environment with no native modules.
 */

// ─── Mocks (must be declared before imports) ──────────────────────────────────

jest.mock('../../config', () => ({
  __esModule: true,
  default: {
    api: {
      baseUrl: 'https://api.petchain.app/api',
      timeoutMs: 10000,
    },
  },
}));

const mockPost = jest.fn();
jest.mock('axios', () => {
  const actual = jest.requireActual<typeof import('axios')>('axios');
  return {
    ...actual,
    create: () => ({ post: mockPost }),
  };
});

// Keychain in-memory store shared between mock and tests
const keychainStore: Record<string, string> = {};

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
  setGenericPassword: jest.fn((_user: string, value: string, opts: { service: string }) => {
    keychainStore[opts.service] = value;
    return Promise.resolve(true);
  }),
  getGenericPassword: jest.fn((opts: { service: string }) => {
    const val = keychainStore[opts.service];
    return Promise.resolve(val ? { username: 'petchain_user', password: val } : false);
  }),
  resetGenericPassword: jest.fn((opts: { service: string }) => {
    delete keychainStore[opts.service];
    return Promise.resolve(true);
  }),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import {
  login,
  logout,
  getToken,
  isAuthenticated,
  refreshToken,
  register,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
  getSession,
  isBiometricAuthenticationAvailable,
  AuthError,
} from '../authService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Encode a string to base64url without Buffer or atob */
function toBase64Url(str: string): string {
  const bytes = Array.from(str).map((c) => c.charCodeAt(0));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return result.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Build a minimal signed JWT with a given exp (seconds since epoch) */
function makeJwt(exp: number): string {
  const header = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  // Use same iat as exp - 3600 to create a realistic token
  const payload = toBase64Url(JSON.stringify({ sub: 'user-1', exp, iat: exp - 3600 }));
  return `${header}.${payload}.fakesig`;
}

const NOW = Math.floor(Date.now() / 1000);
const FUTURE_TOKEN = makeJwt(NOW + 3600); // valid for 1h
const EXPIRED_TOKEN = makeJwt(NOW - 3600); // expired 1h ago

const MOCK_LOGIN_RESPONSE = {
  user: { id: 'u1', email: 'user@example.com', name: 'Test User', role: 'owner' },
  token: FUTURE_TOKEN,
  refreshToken: 'refresh-abc',
  expiresIn: 3600,
};

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(keychainStore).forEach((k) => delete keychainStore[k]);
});

// ─── login() ──────────────────────────────────────────────────────────────────

describe('login()', () => {
  it('returns session and stores tokens on success', async () => {
    mockPost.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

    const session = await login('user@example.com', 'Password1');

    expect(session.token).toBe(FUTURE_TOKEN);
    expect(session.refreshToken).toBe('refresh-abc');
    expect(session.user.email).toBe('user@example.com');
    expect(await getToken()).toBe(FUTURE_TOKEN);
  });

  it('throws MISSING_CREDENTIALS when email is empty', async () => {
    await expect(login('', 'Password1')).rejects.toMatchObject({ code: 'MISSING_CREDENTIALS' });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('throws MISSING_CREDENTIALS when password is empty', async () => {
    await expect(login('user@example.com', '')).rejects.toMatchObject({
      code: 'MISSING_CREDENTIALS',
    });
  });

  it('throws INVALID_CREDENTIALS on 401', async () => {
    const err = Object.assign(new Error('401'), {
      isAxiosError: true,
      response: { status: 401, data: {} },
    });
    mockPost.mockRejectedValueOnce(err);

    await expect(login('user@example.com', 'wrong')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('throws RATE_LIMITED on 429', async () => {
    const err = Object.assign(new Error('429'), {
      isAxiosError: true,
      response: { status: 429, data: {} },
    });
    mockPost.mockRejectedValueOnce(err);

    await expect(login('user@example.com', 'Password1')).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
  });

  it('throws NETWORK_ERROR on non-axios error', async () => {
    mockPost.mockRejectedValueOnce(new Error('Network failure'));

    await expect(login('user@example.com', 'Password1')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
  });

  it('works without a refreshToken in the response', async () => {
    const noRefresh = { ...MOCK_LOGIN_RESPONSE, refreshToken: undefined };
    mockPost.mockResolvedValueOnce({ data: noRefresh });

    const session = await login('user@example.com', 'Password1');
    expect(session.refreshToken).toBeUndefined();
  });
});

describe('register()', () => {
  it('creates account and stores tokens on success', async () => {
    mockPost.mockResolvedValueOnce({ data: MOCK_LOGIN_RESPONSE });

    const session = await register({
      email: 'new@example.com',
      name: 'New User',
      password: 'Password1',
    });

    expect(session.user.email).toBe('user@example.com');
    expect(await getToken()).toBe(FUTURE_TOKEN);
  });

  it('throws MISSING_REGISTRATION_FIELDS when required fields are missing', async () => {
    await expect(
      register({ email: '', name: 'User', password: 'Password1' }),
    ).rejects.toMatchObject({ code: 'MISSING_REGISTRATION_FIELDS' });
  });
});

// ─── logout() ─────────────────────────────────────────────────────────────────

describe('logout()', () => {
  it('clears all stored tokens', async () => {
    keychainStore['com.petchain.auth'] = FUTURE_TOKEN;
    keychainStore['com.petchain.auth.refresh'] = 'refresh-abc';
    mockPost.mockResolvedValueOnce({});

    await logout();

    expect(await getToken()).toBeNull();
  });

  it('still clears tokens even if server call fails', async () => {
    keychainStore['com.petchain.auth'] = FUTURE_TOKEN;
    mockPost.mockRejectedValueOnce(new Error('server down'));

    await logout(); // must not throw

    expect(await getToken()).toBeNull();
  });
});

// ─── getToken() ───────────────────────────────────────────────────────────────

describe('getToken()', () => {
  it('returns null when no token stored', async () => {
    expect(await getToken()).toBeNull();
  });

  it('returns the stored token', async () => {
    keychainStore['com.petchain.auth'] = FUTURE_TOKEN;
    expect(await getToken()).toBe(FUTURE_TOKEN);
  });
});

// ─── isAuthenticated() ────────────────────────────────────────────────────────

describe('isAuthenticated()', () => {
  it('returns false when no token', async () => {
    expect(await isAuthenticated()).toBe(false);
  });

  it('returns true for a valid non-expired token', async () => {
    keychainStore['com.petchain.auth'] = FUTURE_TOKEN;
    expect(await isAuthenticated()).toBe(true);
  });

  it('returns false for an expired token', async () => {
    keychainStore['com.petchain.auth'] = EXPIRED_TOKEN;
    expect(await isAuthenticated()).toBe(false);
  });

  it('returns false for a malformed token', async () => {
    keychainStore['com.petchain.auth'] = 'not.a.jwt';
    expect(await isAuthenticated()).toBe(false);
  });
});

// ─── refreshToken() ───────────────────────────────────────────────────────────

describe('refreshToken()', () => {
  it('exchanges refresh token and stores new access token', async () => {
    keychainStore['com.petchain.auth.refresh'] = 'refresh-abc';
    const newToken = makeJwt(NOW + 7200);
    mockPost.mockResolvedValueOnce({
      data: { token: newToken, refreshToken: 'refresh-new', expiresIn: 7200 },
    });

    const result = await refreshToken();

    expect(result).toBe(newToken);
    expect(await getToken()).toBe(newToken);
    expect(keychainStore['com.petchain.auth.refresh']).toBe('refresh-new');
  });

  it('throws NO_REFRESH_TOKEN when no refresh token stored', async () => {
    await expect(refreshToken()).rejects.toMatchObject({ code: 'NO_REFRESH_TOKEN' });
  });

  it('throws REFRESH_TOKEN_EXPIRED on 401 and clears tokens', async () => {
    keychainStore['com.petchain.auth'] = FUTURE_TOKEN;
    keychainStore['com.petchain.auth.refresh'] = 'refresh-abc';

    const err = Object.assign(new Error('401'), {
      isAxiosError: true,
      response: { status: 401, data: {} },
    });
    mockPost.mockRejectedValueOnce(err);

    await expect(refreshToken()).rejects.toMatchObject({ code: 'REFRESH_TOKEN_EXPIRED' });
    expect(await getToken()).toBeNull();
  });

  it('throws NETWORK_ERROR on non-axios failure and clears tokens', async () => {
    keychainStore['com.petchain.auth.refresh'] = 'refresh-abc';
    mockPost.mockRejectedValueOnce(new Error('timeout'));

    await expect(refreshToken()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(await getToken()).toBeNull();
  });
});

describe('password reset + email verification', () => {
  it('requests password reset with valid email', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } });
    await expect(requestPasswordReset('user@example.com')).resolves.toBeUndefined();
  });

  it('resets password with a valid token', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } });
    await expect(resetPassword('token-123', 'StrongPass1')).resolves.toBeUndefined();
  });

  it('verifies email with token', async () => {
    mockPost.mockResolvedValueOnce({ data: { success: true } });
    await expect(verifyEmail('verify-token-123')).resolves.toBeUndefined();
  });

  it('throws MISSING_EMAIL when requesting reset with empty email', async () => {
    await expect(requestPasswordReset('')).rejects.toMatchObject({ code: 'MISSING_EMAIL' });
  });
});

describe('session management + biometric availability', () => {
  it('returns current session details when token exists', async () => {
    keychainStore['com.petchain.auth'] = FUTURE_TOKEN;
    keychainStore['com.petchain.auth.refresh'] = 'refresh-abc';

    const session = await getSession();
    expect(session).toMatchObject({
      token: FUTURE_TOKEN,
      refreshToken: 'refresh-abc',
    });
  });

  it('returns false when biometric api is unavailable', async () => {
    expect(await isBiometricAuthenticationAvailable()).toBe(false);
  });
});

// ─── AuthError ────────────────────────────────────────────────────────────────

describe('AuthError', () => {
  it('has correct name, code, and message', () => {
    const e = new AuthError('oops', 'TEST_CODE');
    expect(e.name).toBe('AuthError');
    expect(e.code).toBe('TEST_CODE');
    expect(e.message).toBe('oops');
    expect(e instanceof Error).toBe(true);
  });
});
