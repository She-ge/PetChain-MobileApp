import { getItem, setItem, removeItem } from '../services/localDB';
import { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const ACCESS_TOKEN_KEY = '@access_token';
const REFRESH_TOKEN_KEY = '@refresh_token';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export const setupInterceptors = (apiClient: AxiosInstance): void => {
  // Request: auth token injection
  apiClient.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const token = await getItem(ACCESS_TOKEN_KEY);
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    },
    (error: AxiosError) => Promise.reject(error),
  );

  // Request: logging
  apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    },
    (error: AxiosError) => {
      console.error('[API] Request error:', error.message);
      return Promise.reject(error);
    },
  );

  // Response: logging + error handling + token refresh
  apiClient.interceptors.response.use(
    (response) => {
      console.log(`[API] ${response.status} ${response.config.url}`);
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      console.error(`[API] Error ${error.response?.status ?? 'network'}: ${originalRequest?.url}`);

      // Token refresh on 401
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = await getItem(REFRESH_TOKEN_KEY);
          if (!refreshToken) return Promise.reject(error);

          const { data } = await apiClient.post<TokenResponse>('/auth/refresh', { refreshToken });

          await Promise.all([
            setItem(ACCESS_TOKEN_KEY, data.accessToken),
            setItem(REFRESH_TOKEN_KEY, data.refreshToken),
          ]);

          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          return apiClient(originalRequest);
        } catch {
          await Promise.all([
            removeItem(ACCESS_TOKEN_KEY),
            removeItem(REFRESH_TOKEN_KEY),
          ]);
        }
      }

      // Consistent error message
      const message = error.response
        ? `Request failed with status ${error.response.status}`
        : error.message ?? 'Network error';
      return Promise.reject(new Error(message));
    },
  );
};
