import axios from 'axios';
import CryptoJS from 'crypto-js';
import { 
  verifyRecordOnChain, 
  getTransactionDetails, 
  checkRecordIntegrity,
  computeRecordHash
} from '../blockchainService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('blockchainService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('computeRecordHash', () => {
    it('should compute deterministic hash for record', () => {
      const record = { id: '1', data: 'test' };
      const hash1 = computeRecordHash(record);
      const hash2 = computeRecordHash({ data: 'test', id: '1' }); // Reordered
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should ignore hash/tx metadata fields', () => {
      const record1 = { id: '1', data: 'test' };
      const record2 = { id: '1', data: 'test', hash: 'old-hash', txHash: 'tx-123' };
      
      expect(computeRecordHash(record1)).toBe(computeRecordHash(record2));
    });
  });

  describe('verifyRecordOnChain', () => {
    it('should return verification result from API', async () => {
      const mockResult = { verified: true, recordId: '1', onChainHash: 'hash123' };
      mockedAxios.post.mockResolvedValue({ data: mockResult });

      const result = await verifyRecordOnChain('1', 'hash123');
      
      expect(result).toEqual(mockResult);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/blockchain/records/verify'),
        { recordId: '1', hash: 'hash123' }
      );
    });

    it('should throw error if recordId is missing', async () => {
      await expect(verifyRecordOnChain('', 'hash123')).rejects.toThrow('Record ID is required');
    });

    it('should use cache for repeated requests', async () => {
      const mockResult = { verified: true, recordId: '1', onChainHash: 'hash123' };
      mockedAxios.post.mockResolvedValue({ data: mockResult });

      await verifyRecordOnChain('1', 'hash123');
      await verifyRecordOnChain('1', 'hash123');

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTransactionDetails', () => {
    it('should return transaction details', async () => {
      const mockDetails = { hash: 'tx123', successful: true };
      mockedAxios.get.mockResolvedValue({ data: mockDetails });

      const result = await getTransactionDetails('tx123');
      
      expect(result).toEqual(mockDetails);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/blockchain/transactions/tx123')
      );
    });

    it('should throw error if txHash is missing', async () => {
      await expect(getTransactionDetails('')).rejects.toThrow('Transaction hash is required');
    });
  });

  describe('checkRecordIntegrity', () => {
    it('should verify local and on-chain integrity', async () => {
      const record = { id: '1', data: 'test', recordHash: 'hash123' };
      // computeRecordHash for {id:'1', data:'test'} will be different from 'hash123'
      // but let's assume we want to test the flow.
      
      const realHash = computeRecordHash(record);
      const mockVerifyResult = { verified: true, onChainHash: realHash, recordId: '1' };
      mockedAxios.post.mockResolvedValue({ data: mockVerifyResult });

      const result = await checkRecordIntegrity({ ...record, recordHash: realHash });
      
      expect(result.localHashMatchesProvidedHash).toBe(true);
      expect(result.onChainVerified).toBe(true);
    });
  });
});
