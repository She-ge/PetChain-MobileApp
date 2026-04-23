import axios, { type AxiosResponse } from 'axios';

// Types
export interface MedicalRecord {
  id: string;
  petId: string;
  type: 'vaccination' | 'treatment' | 'diagnosis';
  date: string;
  veterinarian: string;
  notes: string;
  createdAt: string;
}

export interface Vaccination extends MedicalRecord {
  type: 'vaccination';
  vaccineName: string;
  nextDueDate?: string;
  batchNumber?: string;
}

export interface Treatment extends MedicalRecord {
  type: 'treatment';
  treatmentName: string;
  medication?: string;
  dosage?: string;
  duration?: string;
}

export interface RecordFilters {
  type?: 'vaccination' | 'treatment' | 'diagnosis';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Custom error class
export class MedicalRecordError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'MedicalRecordError';
  }
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.petchain.com';

// Helper function to handle API errors
const handleApiError = (error: any): never => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;

    switch (status) {
      case 404:
        throw new MedicalRecordError('Pet or records not found', 'NOT_FOUND');
      case 401:
        throw new MedicalRecordError('Unauthorized access', 'UNAUTHORIZED');
      case 403:
        throw new MedicalRecordError('Access forbidden', 'FORBIDDEN');
      case 500:
        throw new MedicalRecordError('Server error', 'SERVER_ERROR');
      default:
        throw new MedicalRecordError(`API error: ${message}`, 'API_ERROR');
    }
  }
  throw new MedicalRecordError('Network error', 'NETWORK_ERROR');
};

// Fetch medical records with optional filtering
export const getMedicalRecords = async (
  petId: string,
  filters?: RecordFilters,
): Promise<PaginatedResponse<MedicalRecord>> => {
  if (!petId) {
    throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');
  }

  try {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response: AxiosResponse<PaginatedResponse<MedicalRecord>> = await axios.get(
      `${API_BASE_URL}/pets/${petId}/medical-records?${params.toString()}`,
    );

    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// Fetch vaccination history
export const getVaccinationHistory = async (petId: string): Promise<Vaccination[]> => {
  if (!petId) {
    throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');
  }

  try {
    const response = await getMedicalRecords(petId, { type: 'vaccination' });
    return response.data as Vaccination[];
  } catch (error) {
    if (error instanceof MedicalRecordError) throw error;
    return handleApiError(error);
  }
};

// Fetch treatment history
export const getTreatmentHistory = async (petId: string): Promise<Treatment[]> => {
  if (!petId) {
    throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');
  }

  try {
    const response = await getMedicalRecords(petId, { type: 'treatment' });
    return response.data as Treatment[];
  } catch (error) {
    if (error instanceof MedicalRecordError) throw error;
    return handleApiError(error);
  }
};
