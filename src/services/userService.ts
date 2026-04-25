import { getItem, setItem, removeItem } from './localDB';
import { savePreferences } from './notificationService';
import type { NotificationPreferences, User } from '../models/User';

const USER_PROFILE_KEY = '@user_profile';

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  medicationReminders: true,
  appointmentReminders: true,
  vaccinationAlerts: true,
  reminderLeadTimeMinutes: 60,
  soundEnabled: true,
  badgeEnabled: true,
};

export async function getUserProfile(): Promise<User | null> {
  const raw = await getItem(USER_PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function saveUserProfile(profile: User): Promise<User> {
  const normalized: User = {
    ...profile,
    notificationPreferences: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(profile.notificationPreferences ?? {}),
    },
  };

  await setItem(USER_PROFILE_KEY, JSON.stringify(normalized));
  await savePreferences(normalized.notificationPreferences ?? {});
  return normalized;
}

export async function updateUserProfile(updates: Partial<Omit<User, 'id'>>): Promise<User> {
  const current = await getUserProfile();
  if (!current) {
    throw new Error('No user profile exists to update');
  }

  const updated: User = {
    ...current,
    ...updates,
    notificationPreferences: {
      ...current.notificationPreferences,
      ...(updates.notificationPreferences ?? {}),
    },
  };

  await setItem(USER_PROFILE_KEY, JSON.stringify(updated));
  if (updates.notificationPreferences) {
    await savePreferences(updated.notificationPreferences ?? {});
  }

  return updated;
}

export async function clearUserProfile(): Promise<void> {
  await removeItem(USER_PROFILE_KEY);
}
