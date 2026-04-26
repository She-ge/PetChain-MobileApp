import axios, { type AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';

import type { MedicalRecord } from './medicalRecordService';

// ==============================
// TYPES (UNCHANGED)
// ==============================

export interface StellarRecordVerification {
  verified: boolean;
  onChainHash?: string;
  recordId: string;
  ledger?: number;
  txHash?: string;
  timestamp?: string;
}

export interface StellarTransactionDetails {
  hash: string;
  successful: boolean;
  ledger?: number;
  createdAt?: string;
  sourceAccount?: string;
  feeCharged?: string;
  memo?: string;
  operationCount?: number;
  [key: string]: unknown;
}

export interface RecordIntegrityResult {
  recordId: string;
  localHash: string;
  providedHash?: string;
  localHashMatchesProvidedHash: boolean;
  onChainVerified: boolean;
  onChainHash?: string;
  txHash?: string;
}

export type MedicalRecordWithChainData = MedicalRecord & {
  hash?: string;
  recordHash?: string;
  txHash?: string;
  blockchainTxHash?: string;
  [key: string]: unknown;
};

// ==============================
// CONFIG
// ==============================

const API_BASE_URL = 'https://api.petchain.app/api';
const CACHE_TTL_MS = 2 * 60 * 1000;

const responseCache = new Map<string, { data: unknown; expiresAt: number }>();
const inFlightRequests = new Map<string, Promise<unknown>>();

// ==============================
// ERROR CLASS
// ==============================

export class BlockchainServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'BlockchainServiceError';
  }
}

// ==============================
// ERROR HANDLER
// ==============================

const handleBlockchainError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    throw new BlockchainServiceError(
      `Blockchain API error (${status}): ${message}`,
      'API_ERROR',
    );
  }

  throw new BlockchainServiceError(
    'Failed to connect to blockchain service',
    'NETWORK_ERROR',
  );
};

// ==============================
// CACHE HELPERS
// ==============================

const getCached = <T>(key: string): T | undefined => {
  const cached = responseCache.get(key);
  if (!cached) return undefined;

  if (Date.now() > cached.expiresAt) {
    responseCache.delete(key);
    return undefined;
  }

  return cached.data as T;
};

const setCached = <T>(key: string, data: T): void => {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
};

const queryWithCache = async <T>(
  cacheKey: string,
  requestFn: () => Promise<T>,
): Promise<T> => {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const existing = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = (async () => {
    try {
      const result = await requestFn();
      setCached(cacheKey, result);
      return result;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, promise);
  return promise;
};

// ==============================
// 🔥 FIX #1: EXPORTED FOR TESTS
// ==============================

export const computeRecordHash = (record: MedicalRecordWithChainData): string => {
  const {
    hash,
    recordHash,
    txHash,
    blockchainTxHash,
    ...payload
  } = record;

  const canonical = JSON.stringify(sortObject(payload));
  return CryptoJS.SHA256(canonical).toString(CryptoJS.enc.Hex);
};

// helper (exported via testUtils too)
const sortObject = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortObject);

  if (value && typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      obj[key] = sortObject((value as any)[key]);
    }
    return obj;
  }

  return value;
};

// ==============================
// PUBLIC API
// ==============================

export const verifyRecordOnChain = async (
  recordId: string,
  hash: string,
): Promise<StellarRecordVerification> => {
  const response = await axios.post(`${API_BASE_URL}/blockchain/records/verify`, {
    recordId: recordId.trim(),
    hash: hash.trim(),
  });

  return response.data;
};

export const verifyRecordIntegrity = async (
  record: MedicalRecordWithChainData,
): Promise<RecordIntegrityResult> => {
  if (!record?.id) {
    throw new BlockchainServiceError('Invalid record', 'INVALID_RECORD');
  }

  const localHash = computeRecordHash(record);
  const providedHash = record.hash || record.recordHash;

  const onChain = await verifyRecordOnChain(record.id, localHash);

  return {
    recordId: record.id,
    localHash,
    providedHash,
    localHashMatchesProvidedHash: providedHash === localHash,
    onChainVerified: onChain.verified,
    onChainHash: onChain.onChainHash,
    txHash: onChain.txHash,
  };
};

// ==============================
// TEST UTILITIES (FIX #2)
// ==============================

export const __testUtils = {
  computeRecordHash,
  sortObject,
};