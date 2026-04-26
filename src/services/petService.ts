import axios from 'axios';

import apiClient from './apiClient';
import { parseQRCodeData } from './qrCodeService';
import { logError } from '../utils/errorLogger';
import {
  pickImage,
  compressImage,
  generateThumbnail,
  uploadToStorage,
} from '../utils/imageUtils';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface PetOwnerSummary {
  id: string;
  name: string;
  email: string;
}

export interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  ownerId: string;
  owner?: PetOwnerSummary;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePetInput {
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  ownerId: string;
}

export interface UpdatePetInput {
  name?: string;
  species?: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ─────────────────────────────────────────────
// ERROR CLASS
// ─────────────────────────────────────────────

export class PetServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PetServiceError';
  }
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const QR_DEEP_LINK_PREFIX = 'petchain://pet/';
const PETS_ENDPOINT = '/pets';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function unwrapApiData<T>(payload: ApiResponse<T> | T): T {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'success' in payload &&
    (payload as any).success === true &&
    'data' in payload
  ) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
}

// 👉 IMPORTANT FIX: no spread in function call context
function logPetError(error: Error, context: Record<string, any>) {
  logError(error, context);
}

function toPetServiceError(error: unknown, context: Record<string, any>): PetServiceError {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;

    const message =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Pet API request failed';

    const code =
      error.response?.data?.error?.code ||
      (status ? `HTTP_${status}` : 'NETWORK_ERROR');

    const finalError = new PetServiceError(message, code, status, error.response?.data);

    logPetError(finalError, {
      service: 'petService',
      action: 'api_error',
      status: status ?? null,
      context,
    });

    return finalError;
  }

  if (error instanceof PetServiceError) {
    logPetError(error, {
      service: 'petService',
      action: 'known_error',
      context,
    });
    return error;
  }

  const finalError = new PetServiceError(
    error instanceof Error ? error.message : 'Unexpected pet service error',
    'UNKNOWN_ERROR',
  );

  logPetError(finalError, {
    service: 'petService',
    action: 'unknown_error',
    context,
  });

  return finalError;
}

// ─────────────────────────────────────────────
// API METHODS
// ─────────────────────────────────────────────

export async function getAllPets(): Promise<Pet[]> {
  try {
    const response = await apiClient.get<ApiResponse<Pet[]> | Pet[]>('/pets');
    return unwrapApiData(response.data);
  } catch (error) {
    throw toPetServiceError(error, { action: 'get_all_pets' });
  }
}

export async function getPetById(petId: string): Promise<Pet> {
  const id = petId.trim();
  if (!id) {
    const err = new PetServiceError('Pet ID is required', 'INVALID_PET_ID');
    logPetError(err, { service: 'petService', action: 'validation' });
    throw err;
  }

  try {
    const response = await apiClient.get(`/pets/${encodeURIComponent(id)}`);
    return unwrapApiData(response.data);
  } catch (error) {
    throw toPetServiceError(error, { action: 'get_pet_by_id', petId: id });
  }
}

export async function getPetByQRCode(qrCode: string): Promise<Pet> {
  const value = qrCode.trim();

  if (!value) {
    const err = new PetServiceError('QR code is required', 'INVALID_QR_CODE');
    logPetError(err, { service: 'petService', action: 'qr_validation' });
    throw err;
  }

  try {
    const response = await apiClient.get(`/pets/qr/${encodeURIComponent(value)}`);
    return unwrapApiData(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      const parsed = parseQRCodeData(value);
      if (parsed?.petId) {
        return getPetById(parsed.petId);
      }
    }

    throw toPetServiceError(error, {
      action: 'get_pet_by_qr',
      qrCode: value,
    });
  }
}

export async function createPet(data: CreatePetInput): Promise<Pet> {
  try {
    const response = await apiClient.post('/pets', data);
    return unwrapApiData(response.data);
  } catch (error) {
    throw toPetServiceError(error, { action: 'create_pet' });
  }
}

export async function updatePet(petId: string, data: UpdatePetInput): Promise<Pet> {
  const id = petId.trim();

  if (!id) {
    const err = new PetServiceError('Pet ID is required', 'INVALID_PET_ID');
    logPetError(err, { service: 'petService', action: 'update_validation' });
    throw err;
  }

  try {
    const response = await apiClient.put(`/pets/${encodeURIComponent(id)}`, data);
    return unwrapApiData(response.data);
  } catch (error) {
    throw toPetServiceError(error, { action: 'update_pet', petId: id });
  }
}

export async function deletePet(petId: string): Promise<void> {
  const id = petId.trim();

  if (!id) {
    const err = new PetServiceError('Pet ID is required', 'INVALID_PET_ID');
    logPetError(err, { service: 'petService', action: 'delete_validation' });
    throw err;
  }

  try {
    await apiClient.delete(`/pets/${encodeURIComponent(id)}`);
  } catch (error) {
    throw toPetServiceError(error, { action: 'delete_pet', petId: id });
  }
}

export async function uploadPetPhoto(petId: string): Promise<string | null> {
  try {
    const image = await pickImage();
    if (!image) return null;

    const compressed = await compressImage(image.uri);
    const thumbnail = await generateThumbnail(image.uri);

    const upload = await uploadToStorage(compressed.uri, petId, thumbnail);

    await updatePet(petId, {
      photoUrl: upload.url,
      thumbnailUrl: upload.thumbnailUrl,
    });

    return upload.url;
  } catch (error) {
    throw toPetServiceError(error, {
      action: 'upload_pet_photo',
      petId,
    });
  }
}