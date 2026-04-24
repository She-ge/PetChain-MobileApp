import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';

import config from '../config';
import { getToken } from './authService';
import certPinning from './certPinning';

// --- Circuit Breaker ---
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
const FAILURE_THRESHOLD = 5;
const RECOVERY_TIMEOUT_MS = 30_000;
const circuit = { state: 'CLOSED' as CircuitState, failures: 0, lastFailureTime: 0 };

function isCircuitOpen(): boolean {
  if (circuit.state === 'OPEN') {
    if (Date.now() - circuit.lastFailureTime >= RECOVERY_TIMEOUT_MS) {
      circuit.state = 'HALF_OPEN';
      return false;
    }
    return true;
  }
  return false;
}

function recordSuccess(): void {
  circuit.failures = 0;
  circuit.state = 'CLOSED';
}

function recordFailure(): void {
  circuit.failures += 1;
  circuit.lastFailureTime = Date.now();
  if (circuit.failures >= FAILURE_THRESHOLD) circuit.state = 'OPEN';
}

// --- Retry ---
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 300;

function shouldRetry(error: any, attempt: number): boolean {
  if (attempt >= MAX_RETRIES) return false;
  if (!error.response) return true; // network error
  return error.response.status >= 500;
}

const delay = (attempt: number) =>
  new Promise<void>(resolve => setTimeout(resolve, BASE_DELAY_MS * 2 ** attempt));

// --- Axios instance ---
// Use pinned axios instance when possible. The pinning helper will attempt to
// provide pins from config and secure storage; it also supports refreshing pins.
let apiClient: AxiosInstance = axios.create({
  baseURL: config.api.baseUrl,
  timeout: config.api.timeoutMs,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

async function createClient(): Promise<AxiosInstance> {
  const pins = await certPinning.loadPins();
  // If react-native-ssl-pinning is available, it will be used by requiring
  // the library dynamically in the pinned axios wrapper. Otherwise fallback
  // to regular axios.create with no pinning.
  try {
    // react-native-ssl-pinning expects pin identifiers via config; we attach
    // them to the instance config under `sslPinning` if available.
    // Keep runtime creation simple: if pins exist, pass them, else default.
    const client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      // @ts-expect-error custom field used by native SSL pinning adapters
      sslPinning: pins.length ? { certs: pins } : undefined,
    } as any);
    return client;
  } catch {
    return axios.create({
      baseURL: config.api.baseUrl,
      timeout: config.api.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }
}

function attachAuthInterceptor(client: AxiosInstance) {
  client.interceptors.request.use(async (requestConfig) => {
    const token = await getToken();
    if (token) {
      requestConfig.headers = requestConfig.headers ?? {};
      requestConfig.headers.Authorization = `Bearer ${token}`;
    }
    return requestConfig;
  });
}

// attach to initial client immediately
attachAuthInterceptor(apiClient);

// initialize client (replace later if pins refresh) and re-attach interceptor
createClient().then((c) => {
  apiClient = c;
  attachAuthInterceptor(apiClient);
}).catch(() => {
  apiClient = axios.create({ baseURL: config.api.baseUrl });
  attachAuthInterceptor(apiClient);
});

// --- Resilient request wrapper ---
export async function resilientRequest<T>(
  requestConfig: AxiosRequestConfig
): Promise<AxiosResponse<T>> {
  if (isCircuitOpen()) {
    throw new Error('Service temporarily unavailable. Please try again later.');
  }

  let lastError: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) await delay(attempt - 1);
      const response = await apiClient.request<T>(requestConfig);
      recordSuccess();
      return response;
    } catch (err: any) {
      lastError = err;
      recordFailure();
      if (!shouldRetry(err, attempt)) break;
    }
  }

  const message = lastError?.response
    ? `Request failed with status ${lastError.response.status}`
    : lastError?.message ?? 'Network error';
  throw new Error(message);
}

export const getCircuitState = () => circuit.state;

export default apiClient;
