import apiClient from './apiClient';

/**
 * Pet model returned by backend APIs.
 */
export interface Pet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  age?: number;
  weight?: number;
  color?: string;
  qrCode: string;
  ownerId: string;
  medicalHistory?: MedicalRecord[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Medical record for a pet.
 */
export interface MedicalRecord {
  id: string;
  date: string;
  type: string;
  description: string;
  veterinarian?: string;
}

/**
 * Payload for creating a new pet.
 */
export interface CreatePetInput {
  name: string;
  species: string;
  breed?: string;
  age?: number;
  weight?: number;
  color?: string;
  ownerId: string;
}

/**
 * Payload for updating a pet.
 */
export interface UpdatePetInput {
  name?: string;
  species?: string;
  breed?: string;
  age?: number;
  weight?: number;
  color?: string;
  medicalHistory?: MedicalRecord[];
}

/**
 * API response wrapper.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Get a pet by ID.
 */
export const getPetById = async (petId: string): Promise<ApiResponse<Pet>> => {
  try {
    const response = await apiClient.get<Pet>(`/pets/${petId}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch pet',
    };
  }
};

/**
 * Get all pets with optional filtering.
 */
export const getAllPets = async (ownerId?: string): Promise<ApiResponse<Pet[]>> => {
  try {
    const params = ownerId ? { ownerId } : {};
    const response = await apiClient.get<Pet[]>('/pets', { params });
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch pets',
    };
  }
};

/**
 * Create a new pet.
 */
export const createPet = async (petData: CreatePetInput): Promise<ApiResponse<Pet>> => {
  try {
    const response = await apiClient.post<Pet>('/pets', petData);
    return {
      success: true,
      data: response.data,
      message: 'Pet created successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to create pet',
    };
  }
};

/**
 * Update an existing pet.
 */
export const updatePet = async (
  petId: string,
  petData: UpdatePetInput,
): Promise<ApiResponse<Pet>> => {
  try {
    const response = await apiClient.put<Pet>(`/pets/${petId}`, petData);
    return {
      success: true,
      data: response.data,
      message: 'Pet updated successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to update pet',
    };
  }
};

/**
 * Delete a pet.
 */
export const deletePet = async (petId: string): Promise<ApiResponse<void>> => {
  try {
    await apiClient.delete(`/pets/${petId}`);
    return {
      success: true,
      message: 'Pet deleted successfully',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to delete pet',
    };
  }
};

/**
 * Get a pet by QR code.
 */
export const getPetByQRCode = async (qrCode: string): Promise<ApiResponse<Pet>> => {
  try {
    const response = await apiClient.get<Pet>(`/pets/qr/${qrCode}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to fetch pet by QR code',
    };
  }
};
