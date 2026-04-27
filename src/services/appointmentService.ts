import * as Notifications from 'expo-notifications';

import { getItem, setItem } from './localDB';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppointmentStatus = 'upcoming' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  petId: string;
  petName: string;
  title: string;
  date: string; // ISO string
  location?: string;
  vetName?: string;
  notes?: string;
  status: AppointmentStatus;
  notificationId?: string;
}

// ─── Storage key ─────────────────────────────────────────────────────────────

const KEY = '@appointments';

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function getAppointments(): Promise<Appointment[]> {
  const raw = await getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Appointment[];
  } catch {
    return [];
  }
}

export async function saveAppointment(appt: Appointment): Promise<void> {
  const all = await getAppointments();
  const idx = all.findIndex((a) => a.id === appt.id);
  if (idx >= 0) {
    all[idx] = appt;
  } else {
    all.push(appt);
  }
  await setItem(KEY, JSON.stringify(all));
}

export async function deleteAppointment(id: string): Promise<void> {
  const all = await getAppointments();
  await setItem(KEY, JSON.stringify(all.filter((a) => a.id !== id)));
}

// ─── Derived views ────────────────────────────────────────────────────────────

export function getUpcoming(appointments: Appointment[]): Appointment[] {
  const now = new Date();
  return appointments
    .filter((a) => a.status === 'upcoming' && new Date(a.date) >= now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function getPast(appointments: Appointment[]): Appointment[] {
  const now = new Date();
  return appointments
    .filter((a) => a.status !== 'upcoming' || new Date(a.date) < now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function scheduleAppointmentReminder(appt: Appointment): Promise<string | null> {
  const trigger = new Date(appt.date);
  trigger.setHours(trigger.getHours() - 1); // 1 hour before
  if (trigger <= new Date()) return null;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Upcoming Appointment',
      body: `${appt.title} for ${appt.petName} in 1 hour${appt.location ? ` at ${appt.location}` : ''}`,
      data: { appointmentId: appt.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: trigger },
  });
  return id;
}

export async function cancelAppointmentReminder(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
