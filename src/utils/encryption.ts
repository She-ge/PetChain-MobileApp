import CryptoJS from 'crypto-js';
import * as Keychain from 'react-native-keychain';

const ENCRYPTION_KEY = 'PETCHAIN_ENCRYPTION_KEY';

// Secure key storage
export const storeEncryptionKey = async (key: string): Promise<boolean> => {
  try {
    await Keychain.setGenericPassword(ENCRYPTION_KEY, key);
    return true;
  } catch (error) {
    throw new Error('Failed to store encryption key');
  }
};

export const getEncryptionKey = async (): Promise<string> => {
  try {
    const credentials = await Keychain.getGenericPassword();
    if (!credentials) throw new Error('No encryption key found');
    return credentials.password;
  } catch (error) {
    throw new Error('Failed to retrieve encryption key');
  }
};

// Encrypt function
export const encrypt = async (data: string): Promise<string> => {
  try {
    const key = await getEncryptionKey();
    return CryptoJS.AES.encrypt(data, key).toString();
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Decrypt function
export const decrypt = async (encryptedData: string): Promise<string> => {
  try {
    const key = await getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(encryptedData, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error('Decryption produced empty result');
    return decrypted;
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Hash function for passwords
export const hashPassword = (password: string): string => {
  try {
    return CryptoJS.SHA256(password).toString();
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};
