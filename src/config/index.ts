import Constants from 'expo-constants';

type Environment = 'development' | 'staging' | 'production';

const extra = Constants.expoConfig?.extra ?? {};

// Resolve env — prefer expo extra (set via app.config.js), fall back to process.env
function env(key: string, fallback = ''): string {
  return (extra[key] as string | undefined) ?? (process.env[key] as string | undefined) ?? fallback;
}

const APP_ENV = env('APP_ENV', 'development') as Environment;

const API_URLS: Record<Environment, string> = {
  development: env('API_BASE_URL', 'http://localhost:3000/api'),
  staging: env('STAGING_API_URL', 'https://staging.petchain.app/api'),
  production: env('PROD_API_URL', 'https://api.petchain.app/api'),
};

const config = {
  env: APP_ENV,
  isDev: APP_ENV === 'development',
  isStaging: APP_ENV === 'staging',
  isProd: APP_ENV === 'production',

  api: {
    baseUrl: API_URLS[APP_ENV],
    timeoutMs: Number(env('API_TIMEOUT', '10000')),
    maxRetries: 3,
    version: '1.0',
  },

  cache: {
    maxSizeMb: Number(env('MAX_CACHE_SIZE', '50')),
    ttlMs: 2 * 60 * 1000,
  },

  pagination: {
    defaultLimit: Number(env('PAGINATION_LIMIT', '20')),
    maxLimit: 100,
  },
  sentry: {
    dsn: env('SENTRY_DSN', ''),
    enableInDev: env('SENTRY_ENABLE_IN_DEV', 'false') === 'true',
  },
} as const;

export type AppConfig = typeof config;
export default config;
