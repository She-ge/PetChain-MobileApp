import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  petId: string;
}

export const getMedications = async (petId: string): Promise<Medication[]> => {
  const { data } = await axios.get(`${API_URL}/medications?petId=${petId}`);
  return data;
};

export const createMedication = async (medication: Omit<Medication, 'id'>): Promise<Medication> => {
  const { data } = await axios.post(`${API_URL}/medications`, medication);
  return data;
};

export const updateMedication = async (
  id: string,
  medication: Partial<Medication>,
): Promise<Medication> => {
  const { data } = await axios.put(`${API_URL}/medications/${id}`, medication);
  return data;
};

export const deleteMedication = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/medications/${id}`);
};

export const getActiveMedications = async (petId: string): Promise<Medication[]> => {
  const medications = await getMedications(petId);
  return medications.filter((med) => med.active);
};
