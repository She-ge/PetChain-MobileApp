import axios from 'axios';

import { setupInterceptors } from '../middleware/apiInterceptors';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api';
const API_TIMEOUT = 30000;

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

setupInterceptors(apiClient);

export default apiClient;
