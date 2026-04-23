import axios, { type AxiosInstance } from 'axios';

import config from '../config';
import { getToken } from './authService';

const apiClient: AxiosInstance = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(async (requestConfig) => {
  const token = await getToken();
  if (token) {
    requestConfig.headers = requestConfig.headers ?? {};
    requestConfig.headers.Authorization = `Bearer ${token}`;
  }
  return requestConfig;
});

export default apiClient;
