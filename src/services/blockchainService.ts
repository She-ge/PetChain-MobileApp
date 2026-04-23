import axios, { type AxiosResponse } from 'axios';
import CryptoJS from 'crypto-js';

import type { MedicalRecord } from './medicalRecordService';

// React Native compatible URLSearchParams implementation
interface IURLSearchParams {
  append(name: string, value: string): void;
  delete(name: string): void;
  get(name: string): string | null;
  getAll(name: string): string[];
  has(name: string): boolean;
  set(name: string, value: string): void;
  sort(): void;
  entries(): IterableIterator<[string, string]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<string>;
  forEach(callback: (value: string, name: string, searchParams: this) => void): void;
  toString(): string;
}

class URLSearchParamsPolyfill implements IURLSearchParams {
  private params: Map<string, string>;

  constructor(
    init?: string | Record<string, string> | [string, string][] | URLSearchParamsPolyfill,
  ) {
    this.params = new Map();

    if (typeof init === 'string') {
      const pairs = init.split('&');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) {
          this.params.set(decodeURIComponent(key), decodeURIComponent(value || ''));
        }
      }
    } else if (init && typeof init === 'object') {
      if (init instanceof URLSearchParamsPolyfill) {
        for (const [key, value] of init.entries()) {
          this.params.set(key, value);
        }
      } else {
        const entries = Array.isArray(init) ? init : Object.entries(init);
        for (const [key, value] of entries) {
          this.params.set(key, String(value));
        }
      }
    }
  }

  append(name: string, value: string): void {
    const existing = this.params.get(name);
    if (existing) {
      this.params.set(name, existing + ',' + value);
    } else {
      this.params.set(name, value);
    }
  }

  delete(name: string): void {
    this.params.delete(name);
  }

  get(name: string): string | null {
    return this.params.get(name) || null;
  }

  getAll(name: string): string[] {
    const value = this.params.get(name);
    return value ? value.split(',') : [];
  }

  has(name: string): boolean {
    return this.params.has(name);
  }

  set(name: string, value: string): void {
    this.params.set(name, value);
  }

  sort(): void {
    const sorted = new Map([...this.params.entries()].sort());
    this.params = sorted;
  }

  entries(): IterableIterator<[string, string]> {
    return this.params.entries();
  }

  keys(): IterableIterator<string> {
    return this.params.keys();
  }

  values(): IterableIterator<string> {
    return this.params.values();
  }

  forEach(callback: (value: string, name: string, searchParams: this) => void): void {
    for (const [name, value] of this.params) {
      callback(value, name, this);
    }
  }

  toString(): string {
    const pairs: string[] = [];
    for (const [key, value] of this.params) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
    return pairs.join('&');
  }
}

// Use polyfill for React Native environment
const URLSearchParamsImpl = URLSearchParamsPolyfill;

/**
 * Shape expected from the backend API for on-chain record verification.
 * `verified` means the submitted hash matches what is anchored on Stellar.
 */
export interface StellarRecordVerification {
  verified: boolean;
  onChainHash?: string;
  recordId: string;
  ledger?: number;
  txHash?: string;
  timestamp?: string;
}

/**
 * Core transaction details returned from the backend abstraction over Stellar.
 * Keep this flexible because different backend providers can include extra fields.
 */
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

/**
 * Result returned by local + on-chain integrity verification.
 */
export interface RecordIntegrityResult {
  recordId: string;
  localHash: string;
  providedHash?: string;
  localHashMatchesProvidedHash: boolean;
  onChainVerified: boolean;
  onChainHash?: string;
  txHash?: string;
}

/**
 * Extend existing MedicalRecord type with optional blockchain fields used by integrity checks.
 */
export type MedicalRecordWithChainData = MedicalRecord & {
  hash?: string;
  recordHash?: string;
  txHash?: string;
  blockchainTxHash?: string;
  [key: string]: unknown;
};

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class BlockchainServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'BlockchainServiceError';
  }
}

// Default API base URL for React Native environment
const API_BASE_URL = 'https://api.petchain.app/api';
const CACHE_TTL_MS = 2 * 60 * 1000;

// Cache stores successful responses to reduce redundant calls for repeated reads.
const responseCache = new Map<string, CacheEntry<unknown>>();
// In-flight map deduplicates concurrent identical requests and avoids backend stampedes.
const inFlightRequests = new Map<string, Promise<unknown>>();

const handleBlockchainError = (error: unknown): never => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    switch (status) {
      case 400:
        throw new BlockchainServiceError(
          `Invalid blockchain request: ${message}`,
          'INVALID_REQUEST',
        );
      case 404:
        throw new BlockchainServiceError(
          'Record or transaction not found on blockchain',
          'NOT_FOUND',
        );
      case 408:
        throw new BlockchainServiceError('Blockchain request timed out', 'TIMEOUT');
      case 429:
        throw new BlockchainServiceError('Blockchain API rate limit exceeded', 'RATE_LIMITED');
      case 500:
      case 502:
      case 503:
      case 504:
        throw new BlockchainServiceError(
          'Blockchain service is temporarily unavailable',
          'SERVICE_UNAVAILABLE',
        );
      default:
        throw new BlockchainServiceError(`Blockchain API error: ${message}`, 'API_ERROR');
    }
  }

  throw new BlockchainServiceError('Failed to connect to blockchain service', 'NETWORK_ERROR');
};

const getCached = <T>(key: string): T | undefined => {
  const cached = responseCache.get(key);
  if (!cached) return undefined;

  if (Date.now() > cached.expiresAt) {
    responseCache.delete(key);
    return undefined;
  }

  return cached.data as T;
};

const setCached = <T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void => {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
};

/**
 * Shared helper that first checks TTL cache, then deduplicates concurrent requests,
 * then caches the successful result.
 */
const queryWithCache = async <T>(cacheKey: string, requestFn: () => Promise<T>): Promise<T> => {
  const cached = getCached<T>(cacheKey);
  if (cached) return cached;

  const existingRequest = inFlightRequests.get(cacheKey) as Promise<T> | undefined;
  if (existingRequest) return existingRequest;

  const requestPromise = (async () => {
    try {
      const result = await requestFn();
      setCached(cacheKey, result);
      return result;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

/**
 * Recursively sorts object keys so hashing is stable across key-order differences.
 */
const toCanonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(toCanonicalValue);
  }

  if (value && typeof value === 'object') {
    const sortedObject: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sortedObject[key] = toCanonicalValue((value as Record<string, unknown>)[key]);
    }
    return sortedObject;
  }

  return value;
};

/**
 * Build a deterministic hash for record payload so tampering changes the digest.
 * We remove hash/tx metadata fields to avoid circular hashing and false mismatches.
 */
const computeRecordHash = (record: MedicalRecordWithChainData): string => {
  const {
    hash: _hash,
    recordHash: _recordHash,
    txHash: _txHash,
    blockchainTxHash: _blockchainTxHash,
    ...payload
  } = record;

  const stablePayload = JSON.stringify(toCanonicalValue(payload));
  return CryptoJS.SHA256(stablePayload).toString(CryptoJS.enc.Hex);
};

/**
 * Verify a record hash against Stellar via backend API.
 */
export const verifyRecordOnChain = async (
  recordId: string,
  hash: string,
): Promise<StellarRecordVerification> => {
  const normalizedRecordId = recordId.trim();
  const normalizedHash = hash.trim().toLowerCase();

  if (!normalizedRecordId) {
    throw new BlockchainServiceError('Record ID is required', 'INVALID_RECORD_ID');
  }
  if (!normalizedHash) {
    throw new BlockchainServiceError('Record hash is required', 'INVALID_HASH');
  }

  const cacheKey = `verify:${normalizedRecordId}:${normalizedHash}`;

  return queryWithCache<StellarRecordVerification>(
    cacheKey,
    async (): Promise<StellarRecordVerification> => {
      try {
        const response: AxiosResponse<StellarRecordVerification> = await axios.post(
          `${API_BASE_URL}/blockchain/records/verify`,
          { recordId: normalizedRecordId, hash: normalizedHash },
        );
        return response.data;
      } catch (error) {
        handleBlockchainError(error);
        throw error; // unreachable but satisfies type checker
      }
    },
  );
};

/**
 * Fetch Stellar transaction details via backend API.
 */
export const getTransactionDetails = async (txHash: string): Promise<StellarTransactionDetails> => {
  const normalizedTxHash = txHash.trim();

  if (!normalizedTxHash) {
    throw new BlockchainServiceError('Transaction hash is required', 'INVALID_TX_HASH');
  }

  const cacheKey = `tx:${normalizedTxHash}`;

  return queryWithCache<StellarTransactionDetails>(
    cacheKey,
    async (): Promise<StellarTransactionDetails> => {
      try {
        const response: AxiosResponse<StellarTransactionDetails> = await axios.get(
          `${API_BASE_URL}/blockchain/transactions/${encodeURIComponent(normalizedTxHash)}`,
        );
        return response.data;
      } catch (error) {
        handleBlockchainError(error);
        throw error; // unreachable but satisfies type checker
      }
    },
  );
};

/**
 * Verify record integrity by:
 * 1) computing a local hash from record payload
 * 2) comparing against record's provided hash (if present)
 * 3) validating the local hash against what is anchored on Stellar
 */
export const verifyRecordIntegrity = async (
  record: MedicalRecordWithChainData,
): Promise<RecordIntegrityResult> => {
  if (!record?.id?.trim()) {
    throw new BlockchainServiceError('Record with valid ID is required', 'INVALID_RECORD');
  }

  const localHash = computeRecordHash(record);
  const providedHash = record.hash || record.recordHash;
  const localHashMatchesProvidedHash = providedHash ? localHash === providedHash : false;

  const onChain = await verifyRecordOnChain(record.id, localHash);

  return {
    recordId: record.id,
    localHash,
    providedHash,
    localHashMatchesProvidedHash,
    onChainVerified: onChain.verified,
    onChainHash: onChain.onChainHash,
    txHash: onChain.txHash || record.txHash || record.blockchainTxHash,
  };
};

/**
 * Store a medical record hash on the Stellar blockchain.
 */
export const storeRecordOnChain = async (
  recordId: string,
  hash: string,
  metadata?: Record<string, unknown>,
): Promise<StellarTransactionDetails> => {
  const normalizedRecordId = recordId.trim();
  const normalizedHash = hash.trim().toLowerCase();

  if (!normalizedRecordId) {
    throw new BlockchainServiceError('Record ID is required', 'INVALID_RECORD_ID');
  }
  if (!normalizedHash) {
    throw new BlockchainServiceError('Record hash is required', 'INVALID_HASH');
  }

  const cacheKey = `store:${normalizedRecordId}:${normalizedHash}`;

  return queryWithCache<StellarTransactionDetails>(
    cacheKey,
    async (): Promise<StellarTransactionDetails> => {
      try {
        const response: AxiosResponse<StellarTransactionDetails> = await axios.post(
          `${API_BASE_URL}/blockchain/records/store`,
          {
            recordId: normalizedRecordId,
            hash: normalizedHash,
            metadata: metadata || {},
          },
        );
        return response.data;
      } catch (error) {
        handleBlockchainError(error);
        throw error; // unreachable but satisfies type checker
      }
    },
  );
};

/**
 * Retrieve record hash from Stellar blockchain.
 */
export const retrieveRecordHash = async (
  recordId: string,
): Promise<{ hash: string; txHash: string; timestamp: string; ledger?: number }> => {
  const normalizedRecordId = recordId.trim();

  if (!normalizedRecordId) {
    throw new BlockchainServiceError('Record ID is required', 'INVALID_RECORD_ID');
  }

  const cacheKey = `retrieve:${normalizedRecordId}`;

  return queryWithCache<{ hash: string; txHash: string; timestamp: string; ledger?: number }>(
    cacheKey,
    async () => {
      try {
        const response: AxiosResponse<{
          hash: string;
          txHash: string;
          timestamp: string;
          ledger?: number;
        }> = await axios.get(
          `${API_BASE_URL}/blockchain/records/${encodeURIComponent(normalizedRecordId)}/hash`,
        );
        return response.data;
      } catch (error) {
        handleBlockchainError(error);
        throw error; // unreachable but satisfies type checker
      }
    },
  );
};

/**
 * Get transaction history for a specific record or account.
 */
export const getTransactionHistory = async (
  recordId?: string,
  accountId?: string,
  limit?: number,
): Promise<StellarTransactionDetails[]> => {
  const params = new URLSearchParamsImpl();
  if (recordId) params.append('recordId', recordId.trim());
  if (accountId) params.append('accountId', accountId.trim());
  if (limit) params.append('limit', limit.toString());

  const cacheKey = `history:${recordId || 'all'}:${accountId || 'all'}:${limit || 50}`;

  return queryWithCache<StellarTransactionDetails[]>(cacheKey, async () => {
    try {
      const response: AxiosResponse<StellarTransactionDetails[]> = await axios.get(
        `${API_BASE_URL}/blockchain/transactions/history?${params.toString()}`,
      );
      return response.data;
    } catch (error) {
      handleBlockchainError(error);
      throw error; // unreachable but satisfies type checker
    }
  });
};

/**
 * Connect to Stellar network and get network info.
 */
export const getStellarNetworkInfo = async (): Promise<{
  network: string;
  horizonUrl: string;
  passphrase: string;
  currentLedger: number;
  latestLedger: number;
}> => {
  const cacheKey = 'network-info';

  return queryWithCache<{
    network: string;
    horizonUrl: string;
    passphrase: string;
    currentLedger: number;
    latestLedger: number;
  }>(cacheKey, async () => {
    try {
      const response: AxiosResponse<{
        network: string;
        horizonUrl: string;
        passphrase: string;
        currentLedger: number;
        latestLedger: number;
      }> = await axios.get(`${API_BASE_URL}/blockchain/network/info`);
      return response.data;
    } catch (error) {
      handleBlockchainError(error);
      throw error; // unreachable but satisfies type checker
    }
  });
};

/**
 * Batch verify multiple records on chain.
 */
export const batchVerifyRecords = async (
  records: Array<{ id: string; hash: string }>,
): Promise<StellarRecordVerification[]> => {
  if (!records || records.length === 0) {
    throw new BlockchainServiceError(
      'At least one record is required for batch verification',
      'INVALID_REQUEST',
    );
  }

  const normalizedRecords = records.map((record) => ({
    recordId: record.id.trim(),
    hash: record.hash.trim().toLowerCase(),
  }));

  const cacheKey = `batch:${normalizedRecords.map((r) => `${r.recordId}:${r.hash}`).join(',')}`;

  return queryWithCache<StellarRecordVerification[]>(cacheKey, async () => {
    try {
      const response: AxiosResponse<StellarRecordVerification[]> = await axios.post(
        `${API_BASE_URL}/blockchain/records/batch-verify`,
        normalizedRecords,
      );
      return response.data;
    } catch (error) {
      handleBlockchainError(error);
      throw error; // unreachable but satisfies type checker
    }
  });
};

/**
 * Utilities exposed for testing/maintenance of cache behavior.
 */
export const clearBlockchainCache = (): void => {
  responseCache.clear();
  inFlightRequests.clear();
};

export const invalidateBlockchainCacheKey = (key: string): void => {
  responseCache.delete(key);
};

export { BlockchainServiceError };
