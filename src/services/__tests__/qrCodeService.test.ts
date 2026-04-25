import { generatePetQRCode, parseQRCodeData, validateQRCode } from '../qrCodeService';

describe('qrCodeService', () => {
  const mockPetId = 'pet-123';

  describe('generatePetQRCode', () => {
    it('should generate a valid base64 encoded QR payload', () => {
      const qrCode = generatePetQRCode(mockPetId);
      expect(typeof qrCode).toBe('string');
      expect(qrCode.length).toBeGreaterThan(0);
      
      // Should be decodable
      const parsed = parseQRCodeData(qrCode);
      expect(parsed.petId).toBe(mockPetId);
      expect(parsed.deepLink).toContain(mockPetId);
    });

    it('should throw error for empty petId', () => {
      expect(() => generatePetQRCode('')).toThrow('petId must not be empty');
    });

    it('should throw error for invalid petId format', () => {
      expect(() => generatePetQRCode('pet id with spaces')).toThrow('petId contains invalid characters');
    });
  });

  describe('parseQRCodeData', () => {
    it('should parse valid QR data', () => {
      const qrCode = generatePetQRCode(mockPetId);
      const parsed = parseQRCodeData(qrCode);
      expect(parsed.petId).toBe(mockPetId);
    });

    it('should throw error for empty data', () => {
      expect(() => parseQRCodeData('')).toThrow('QR data is empty');
    });

    it('should throw error for invalid JSON', () => {
      const invalidData = 'not-json';
      // In a real scenario, this would be base64 encoded, but let's test the catch block
      expect(() => parseQRCodeData('YWJj')).toThrow('QR parsing failed');
    });
  });

  describe('validateQRCode', () => {
    it('should validate correct QR code', () => {
      const qrCode = generatePetQRCode(mockPetId);
      const result = validateQRCode(qrCode);
      expect(result.valid).toBe(true);
      expect(result.petId).toBe(mockPetId);
    });

    it('should return invalid for tampered data', () => {
      const qrCode = generatePetQRCode(mockPetId);
      // Tamper with the data (this is a bit simplified, but testing the logic)
      const result = validateQRCode('tampered-base64');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should return invalid for empty data', () => {
      const result = validateQRCode('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('QR data is empty');
    });
  });
});
