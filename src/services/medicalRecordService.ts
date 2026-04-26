import axios, { type AxiosResponse } from 'axios';
import { getItem, setItem } from './localDB';
import offlineQueue from './offlineQueue';

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

export class MedicalRecordError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'MedicalRecordError';
  }
}

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || 'https://api.petchain.com';

// ─────────────────────────────────────────────────────────────────────────────
// Error handler
// ─────────────────────────────────────────────────────────────────────────────

const RECORDS_CACHE_PREFIX = '@records_';

async function cacheRecords(petId: string, records: MedicalRecord[]): Promise<void> {
  await setItem(`${RECORDS_CACHE_PREFIX}${petId}`, JSON.stringify(records));
}

async function getCachedRecords(petId: string): Promise<MedicalRecord[]> {
  const cached = await getItem(`${RECORDS_CACHE_PREFIX}${petId}`);
  return cached ? JSON.parse(cached) : [];
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Existing function (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

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

    const response: AxiosResponse<PaginatedResponse<MedicalRecord>> =
      await axios.get(
        `${API_BASE_URL}/pets/${petId}/medical-records?${params.toString()}`,
      );

    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ✅ ADDED: REQUIRED BY YOUR TESTS
// ─────────────────────────────────────────────────────────────────────────────

export const getRecordById = async (
  petId: string,
  recordId: string,
): Promise<MedicalRecord> => {
  if (!petId || !recordId) {
    throw new MedicalRecordError(
      'Pet ID and Record ID are required',
      'INVALID_INPUT',
    );
  }

  try {
    const response: AxiosResponse<MedicalRecord> = await axios.get(
      `${API_BASE_URL}/pets/${petId}/medical-records/${recordId}`,
    );

    const data = response.data;
    // Only cache if no filters are applied (full set) or handle caching strategy
    if (!filters || Object.keys(filters).length === 0) {
      await cacheRecords(petId, data.data);
    }
    return data;
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      const cached = await getCachedRecords(petId);
      let filtered = cached;
      if (filters?.type) {
        filtered = filtered.filter(r => r.type === filters.type);
      }
      return {
        data: filtered,
        total: filtered.length,
        page: 1,
        limit: filters?.limit || 10,
        totalPages: 1,
      };
    }
    return handleApiError(error);
  }
};

export const createMedicalRecord = async (
  petId: string,
  data: Partial<MedicalRecord>,
): Promise<MedicalRecord> => {
  if (!petId) {
    throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');
  }

  try {
    const response: AxiosResponse<MedicalRecord> = await axios.post(
      `${API_BASE_URL}/pets/${petId}/medical-records`,
      data,
    );

    return response.data;
  } catch (error) {
    return handleApiError(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Existing helpers (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const getVaccinationHistory = async (
  petId: string,
): Promise<Vaccination[]> => {
  if (!petId) {
    throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');
  }

  try {
    const response = await getMedicalRecords(petId, {
      type: 'vaccination',
    });

    return response.data as Vaccination[];
  } catch (error) {
    if (error instanceof MedicalRecordError) throw error;
    return handleApiError(error);
  }
};

export const getTreatmentHistory = async (
  petId: string,
): Promise<Treatment[]> => {
  if (!petId) {
    throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');
  }

  try {
    const response = await getMedicalRecords(petId, {
      type: 'treatment',
    });

    return response.data as Treatment[];
  } catch (error) {
    if (error instanceof MedicalRecordError) throw error;
    return handleApiError(error);
  }
};

// Collect all searchable string values from a record (all fields)
const extractSearchableText = (record: MedicalRecord): string => {
  const parts: string[] = [];
  const collect = (val: unknown) => {
    if (typeof val === 'string') parts.push(val.toLowerCase());
    else if (Array.isArray(val)) val.forEach(collect);
    else if (val && typeof val === 'object') Object.values(val).forEach(collect);
  };
  collect(record);
  return parts.join(' ');
};

// Search medical records by text across all fields
export const searchMedicalRecords = async (
  petId: string,
  query: string,
): Promise<MedicalRecord[]> => {
  if (!petId) throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');
  if (!query.trim()) return [];

  const { data } = await getMedicalRecords(petId, { limit: 1000 });
  const q = query.trim().toLowerCase();
  return data.filter((record) => extractSearchableText(record).includes(q));
};

export const createMedicalRecord = async (
  petId: string,
  data: Partial<MedicalRecord>,
): Promise<MedicalRecord> => {
  if (!petId) throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');

  try {
    const response = await axios.post(`${API_BASE_URL}/pets/${petId}/medical-records`, data);
    const newRecord = response.data;
    
    // Update cache
    const cached = await getCachedRecords(petId);
    cached.unshift(newRecord);
    await cacheRecords(petId, cached);
    
    return newRecord;
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      const tempId = `temp_${Date.now()}`;
      const newRecord: MedicalRecord = {
        ...data,
        id: tempId,
        petId,
        createdAt: new Date().toISOString(),
      } as MedicalRecord;

      await offlineQueue.enqueue('medicalRecord', 'create', newRecord as any);
      
      const cached = await getCachedRecords(petId);
      cached.unshift(newRecord);
      await cacheRecords(petId, cached);
      
      return newRecord;
    }
    return handleApiError(error);
  }
};

export const updateMedicalRecord = async (
  petId: string,
  recordId: string,
  data: Partial<MedicalRecord>,
): Promise<MedicalRecord> => {
  if (!petId) throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');
  if (!recordId) throw new MedicalRecordError('Record ID is required', 'INVALID_RECORD_ID');

  try {
    const response = await axios.put(`${API_BASE_URL}/pets/${petId}/medical-records/${recordId}`, data);
    const updatedRecord = response.data;
    
    // Update cache
    const cached = await getCachedRecords(petId);
    const idx = cached.findIndex(r => r.id === recordId);
    if (idx >= 0) {
      cached[idx] = updatedRecord;
      await cacheRecords(petId, cached);
    }
    
    return updatedRecord;
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      const cached = await getCachedRecords(petId);
      const idx = cached.findIndex(r => r.id === recordId);
      if (idx >= 0) {
        const updatedRecord = { ...cached[idx], ...data };
        await offlineQueue.enqueue('medicalRecord', 'update', { id: recordId, petId, ...data });
        cached[idx] = updatedRecord;
        await cacheRecords(petId, cached);
        return updatedRecord;
      }
    }
    return handleApiError(error);
  }
};

export const deleteMedicalRecord = async (
  petId: string,
  recordId: string,
): Promise<void> => {
  if (!petId) throw new MedicalRecordError('Pet ID is required', 'INVALID_PET_ID');
  if (!recordId) throw new MedicalRecordError('Record ID is required', 'INVALID_RECORD_ID');

  try {
    await axios.delete(`${API_BASE_URL}/pets/${petId}/medical-records/${recordId}`);
    
    // Update cache
    const cached = await getCachedRecords(petId);
    await cacheRecords(petId, cached.filter(r => r.id !== recordId));
  } catch (error) {
    if (axios.isAxiosError(error) && !error.response) {
      await offlineQueue.enqueue('medicalRecord', 'delete', { id: recordId, petId });
      const cached = await getCachedRecords(petId);
      await cacheRecords(petId, cached.filter(r => r.id !== recordId));
      return;
    }
    return handleApiError(error);
  }
};
