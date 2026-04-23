import CryptoJS from 'crypto-js';

export interface PetQRData {
  petId: string;
  deepLink: string;
  generatedAt: number;
  checksum: string;
}

export interface QRValidationResult {
  valid: boolean;
  petId?: string;
  error?: string;
}

const DEEP_LINK_SCHEME = 'petchain://pet';
const QR_PREFIX = 'PETCHAIN_QR';
const PET_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

const buildDeepLink = (petId: string): string => `${DEEP_LINK_SCHEME}/${encodeURIComponent(petId)}`;

const computeChecksum = (petId: string, deepLink: string, generatedAt: number): string =>
  CryptoJS.SHA256(`${QR_PREFIX}|${petId}|${deepLink}|${generatedAt}`).toString();

export const generatePetQRCode = (petId: string): string => {
  try {
    if (petId.trim().length === 0) {
      throw new Error('petId must not be empty');
    }
    if (PET_ID_REGEX.test(petId) === false) {
      throw new Error(
        'petId contains invalid characters. Allowed: letters, digits, hyphens, underscores (max 64 chars)',
      );
    }
    const generatedAt = Date.now();
    const deepLink = buildDeepLink(petId);
    const checksum = computeChecksum(petId, deepLink, generatedAt);
    const payload: PetQRData = { petId, deepLink, generatedAt, checksum };
    return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(JSON.stringify(payload)));
  } catch (error) {
    throw new Error(
      `QR generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

export const parseQRCodeData = (qrData: string): PetQRData => {
  try {
    if (qrData.trim().length === 0) {
      throw new Error('QR data is empty');
    }
    const decoded = CryptoJS.enc.Base64.parse(qrData.trim()).toString(CryptoJS.enc.Utf8);
    if (decoded.length === 0) {
      throw new Error('QR data could not be decoded from base64');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(decoded);
    } catch {
      throw new Error('QR data does not contain valid JSON');
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('QR data is not a valid object');
    }
    const obj = parsed as Record<string, unknown>;
    const requiredFields: (keyof PetQRData)[] = ['petId', 'deepLink', 'generatedAt', 'checksum'];
    for (const field of requiredFields) {
      if (field in obj === false) {
        throw new Error(`QR data is missing required field: "${field}"`);
      }
    }
    return obj as unknown as PetQRData;
  } catch (error) {
    throw new Error(
      `QR parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

export const validateQRCode = (qrData: string): QRValidationResult => {
  if (qrData.trim().length === 0) {
    return { valid: false, error: 'QR data is empty' };
  }
  let data: PetQRData;
  try {
    data = parseQRCodeData(qrData);
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to parse QR data',
    };
  }
  if (PET_ID_REGEX.test(data.petId) === false) {
    return { valid: false, error: 'QR code contains an invalid pet ID format' };
  }
  const expectedDeepLink = buildDeepLink(data.petId);
  if (data.deepLink !== expectedDeepLink) {
    return { valid: false, error: 'QR code contains an invalid deep link' };
  }
  const expectedChecksum = computeChecksum(data.petId, data.deepLink, data.generatedAt);
  if (data.checksum !== expectedChecksum) {
    return { valid: false, error: 'QR code checksum mismatch - data may have been tampered with' };
  }
  return { valid: true, petId: data.petId };
};
