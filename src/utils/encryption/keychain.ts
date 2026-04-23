import * as Keychain from 'react-native-keychain';

import { EncryptionError } from './types';

const ENCRYPTION_KEY = 'PETCHAIN_ENCRYPTION_KEY';

// Secure key storage
export const storeEncryptionKey = async (key: string): Promise<boolean> => {
  if (!key || typeof key !== 'string' || key.trim().length === 0) {
    throw new EncryptionError('Encryption key cannot be empty', 'INVALID_KEY');
  }

  try {
    await Keychain.setGenericPassword(ENCRYPTION_KEY, key);
    return true;
  } catch (error) {
    throw new EncryptionError(
      `Failed to store encryption key: ${error instanceof Error ? error.message : 'Unknown keychain error'}`,
      'KEYCHAIN_STORE_ERROR',
    );
  }
};

export const getEncryptionKey = async (): Promise<string> => {
  try {
    const credentials = await Keychain.getGenericPassword();
    if (!credentials) {
      throw new EncryptionError('No encryption key found in keychain', 'KEY_NOT_FOUND');
    }
    return credentials.password;
  } catch (error) {
    if (error instanceof EncryptionError) throw error;
    throw new EncryptionError(
      `Failed to retrieve encryption key: ${error instanceof Error ? error.message : 'Unknown keychain error'}`,
      'KEYCHAIN_RETRIEVE_ERROR',
    );
  }
};
