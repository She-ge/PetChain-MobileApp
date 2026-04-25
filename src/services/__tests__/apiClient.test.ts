import axios from 'axios';
import apiClient, { resilientRequest, getCircuitState } from '../apiClient';
import { getToken } from '../authService';

// Mock dependencies
jest.mock('axios', () => {
  const mockAxios = {
    create: jest.fn(() => mockAxios),
    request: jest.fn(),
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  };
  return mockAxios;
});

jest.mock('../authService', () => ({
  getToken: jest.fn(),
}));

jest.mock('../config', () => ({
  api: {
    baseUrl: 'https://api.test.com',
    timeoutMs: 1000,
  },
}));

describe('apiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset circuit state if possible - since it's a module-level variable, 
    // we might need to be careful or export a reset function.
    // For now, we'll just test the logic.
  });

  describe('interceptor', () => {
    it('should add Authorization header if token exists', async () => {
      const mockToken = 'test-token';
      (getToken as jest.Mock).mockResolvedValue(mockToken);
      
      const interceptor = (apiClient.interceptors.request.use as jest.Mock).mock.calls[0][0];
      const config = { headers: {} };
      const updatedConfig = await interceptor(config);
      
      expect(updatedConfig.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should not add Authorization header if token does not exist', async () => {
      (getToken as jest.Mock).mockResolvedValue(null);
      
      const interceptor = (apiClient.interceptors.request.use as jest.Mock).mock.calls[0][0];
      const config = { headers: {} };
      const updatedConfig = await interceptor(config);
      
      expect(updatedConfig.headers.Authorization).toBeUndefined();
    });
  });

  describe('resilientRequest', () => {
    it('should return response on success', async () => {
      const mockResponse = { data: 'success' };
      (apiClient.request as jest.Mock).mockResolvedValue(mockResponse);

      const result = await resilientRequest({ url: '/test' });
      expect(result).toBe(mockResponse);
      expect(getCircuitState()).toBe('CLOSED');
    });

    it('should retry on 500 error and eventually succeed', async () => {
      const mockResponse = { data: 'success' };
      const error500 = { response: { status: 500 } };
      
      (apiClient.request as jest.Mock)
        .mockRejectedValueOnce(error500)
        .mockResolvedValueOnce(mockResponse);

      const result = await resilientRequest({ url: '/test' });
      expect(result).toBe(mockResponse);
      expect(apiClient.request).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 400 error', async () => {
      const error400 = { response: { status: 400 } };
      (apiClient.request as jest.Mock).mockRejectedValue(error400);

      await expect(resilientRequest({ url: '/test' })).rejects.toThrow('Request failed with status 400');
      expect(apiClient.request).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after multiple failures', async () => {
      const networkError = new Error('Network Error');
      (apiClient.request as jest.Mock).mockRejectedValue(networkError);

      // FAILURE_THRESHOLD is 5
      for (let i = 0; i < 5; i++) {
        try { await resilientRequest({ url: '/test' }); } catch (e) {}
      }

      expect(getCircuitState()).toBe('OPEN');
      await expect(resilientRequest({ url: '/test' })).rejects.toThrow('Service temporarily unavailable');
    });
  });
});
