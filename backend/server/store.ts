import { randomUUID } from 'crypto';

import { AppointmentStatus, AppointmentType } from '../models/Appointment';
import { UserRole } from '../models/UserRole';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  pets: Array<{ id: string; name?: string }>;
  createdAt: string;
  updatedAt: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  passwordHash?: string;
}

export interface StoredPet {
  id: string;
  name: string;
  species: string;
  breed?: string;
  dateOfBirth?: string;
  microchipId?: string;
  photoUrl?: string;
  thumbnailUrl?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMedicalRecord {
  id: string;
  petId: string;
  vetId: string;
  type: string;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  visitDate: string;
  nextVisitDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredAppointment {
  id: string;
  petId: string;
  vetId: string;
  date: string;
  time: string;
  durationMinutes?: number;
  type: AppointmentType;
  status: AppointmentStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

/** Matches `backend/services/medicationService` client expectations. */
export interface StoredMedication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: string;
  endDate?: string;
  active: boolean;
}

const now = () => new Date().toISOString();

function seed() {
  const userId = 'u-demo-1';
  const petId = 'p-demo-1';
  const vetId = 'v-demo-1';
  const t = now();

  const users = new Map<string, StoredUser>();
  users.set(userId, {
    id: userId,
    email: 'demo@petchain.app',
    name: 'Demo User',
    phone: '+10000000000',
    role: UserRole.OWNER,
    pets: [{ id: petId, name: 'Buddy' }],
    createdAt: t,
    updatedAt: t,
    isEmailVerified: true,
    lastLoginAt: t,
  });

  const pets = new Map<string, StoredPet>();
  pets.set(petId, {
    id: petId,
    name: 'Buddy',
    species: 'dog',
    breed: 'Mixed',
    dateOfBirth: '2020-01-15',
    microchipId: 'CHIP-DEMO-1',
    ownerId: userId,
    createdAt: t,
    updatedAt: t,
  });

  const medicalRecords = new Map<string, StoredMedicalRecord>();
  const mrId = 'mr-demo-1';
  medicalRecords.set(mrId, {
    id: mrId,
    petId,
    vetId,
    type: 'vaccination',
    diagnosis: 'Annual wellness',
    treatment: 'Rabies vaccine',
    notes: 'No adverse reaction',
    visitDate: t.slice(0, 10),
    nextVisitDate: '2027-01-01',
    createdAt: t,
    updatedAt: t,
  });

  const appointments = new Map<string, StoredAppointment>();
  const apId = 'ap-demo-1';
  appointments.set(apId, {
    id: apId,
    petId,
    vetId,
    date: new Date(Date.now() + 86400000 * 7).toISOString().slice(0, 10),
    time: '10:00',
    durationMinutes: 30,
    type: AppointmentType.ROUTINE_CHECKUP,
    status: AppointmentStatus.CONFIRMED,
    notes: 'Demo appointment',
    createdAt: t,
    updatedAt: t,
  });

  const medications = new Map<string, StoredMedication>();
  const medId = 'med-demo-1';
  medications.set(medId, {
    id: medId,
    petId,
    name: 'Demo Med',
    dosage: '5mg',
    frequency: 'once_daily',
    startDate: t.slice(0, 10),
    active: true,
  });

  return { users, pets, medicalRecords, appointments, medications };
}

const state = seed();

export function newId(): string {
  return randomUUID();
}

export const store = {
  ...state,
  newId,
};
