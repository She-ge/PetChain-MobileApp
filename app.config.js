/* eslint-disable @typescript-eslint/no-require-imports, no-undef */

// Load .env.<APP_ENV> via dotenv
const APP_ENV = process.env.APP_ENV ?? 'development';

require('dotenv').config({ path: `.env.${APP_ENV}` });

// Version codes: dev=1, staging=2, prod=3
const VERSION_CODE = { development: 1, staging: 2, production: 3 }[APP_ENV] ?? 1;
const APP_VERSION = '1.0.0';

const APP_NAME_MAP = {
  development: 'PetChain (Dev)',
  staging: 'PetChain (Staging)',
  production: 'PetChain',
};

module.exports = {
  expo: {
    name: APP_NAME_MAP[APP_ENV] ?? 'PetChain',
    slug: 'petchain-mobile',
    version: APP_VERSION,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
      bundleIdentifier:
        APP_ENV === 'production' ? 'app.petchain.mobile' : `app.petchain.mobile.${APP_ENV}`,
      buildNumber: String(VERSION_CODE),
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: APP_ENV === 'production' ? 'app.petchain.mobile' : `app.petchain.mobile.${APP_ENV}`,
      versionCode: VERSION_CODE,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        '@sentry/react-native/expo',
        {
          organization: 'petchain',
          project: 'mobile-app',
        },
      ],
    ],
    extra: {
      APP_ENV,
      API_BASE_URL: process.env.API_BASE_URL ?? 'http://localhost:3000/api',
      STAGING_API_URL: process.env.STAGING_API_URL ?? 'https://staging.petchain.app/api',
      PROD_API_URL: process.env.PROD_API_URL ?? 'https://api.petchain.app/api',
      API_TIMEOUT: process.env.API_TIMEOUT ?? '10000',
      SENTRY_DSN: process.env.SENTRY_DSN ?? '',
      SENTRY_ENABLE_IN_DEV: process.env.SENTRY_ENABLE_IN_DEV ?? 'false',
      MAX_CACHE_SIZE: process.env.MAX_CACHE_SIZE ?? '50',
      PAGINATION_LIMIT: process.env.PAGINATION_LIMIT ?? '20',
    },
  },
};
