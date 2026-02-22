/**
 * Supported medication frequency values used by the backend API.
 */
export enum MedicationFrequency {
  ONCE_DAILY = "once_daily",
  TWICE_DAILY = "twice_daily",
  THREE_TIMES_DAILY = "three_times_daily",
  EVERY_OTHER_DAY = "every_other_day",
  WEEKLY = "weekly",
  AS_NEEDED = "as_needed",
}

/**
 * Medication lifecycle states used for tracking active and historical plans.
 */
export enum MedicationStatus {
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  DISCONTINUED = "discontinued",
}

/**
 * Core medication model returned by backend APIs.
 */
export interface Medication {
  id: string;
  petId: string;
  name: string;
  dosage: string;
  frequency: MedicationFrequency;
  durationDays: number;
  startDate: string;
  endDate?: string;
  status: MedicationStatus;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload used to create a new medication schedule.
 */
export interface CreateMedicationInput {
  petId: string;
  name: string;
  dosage: string;
  frequency: MedicationFrequency;
  durationDays: number;
  startDate: string;
  endDate?: string;
  status?: MedicationStatus;
  instructions?: string;
}

/**
 * Payload used to update editable medication fields.
 */
export interface UpdateMedicationInput {
  name?: string;
  dosage?: string;
  frequency?: MedicationFrequency;
  durationDays?: number;
  startDate?: string;
  endDate?: string;
  status?: MedicationStatus;
  instructions?: string;
}
