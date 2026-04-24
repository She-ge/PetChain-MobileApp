import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: number; // hours between doses
  startDate: string;
  endDate?: string;
}

export interface Appointment {
  id: string;
  title: string;
  date: string;
  location?: string;
}

export interface Vaccination {
  id: string;
  name: string;
  dueDate: string;
  petId: string;
}

export interface NotificationPreferences {
  medicationReminders: boolean;
  appointmentReminders: boolean;
  vaccinationAlerts: boolean;
  reminderLeadTimeMinutes: number; // how many minutes before appointment to notify
  soundEnabled: boolean;
  badgeEnabled: boolean;
}

export type NotificationGroup = 'medication' | 'appointment' | 'vaccination' | 'alert';

const PREFS_KEY = '@notification_preferences';
const NOTIFICATION_MAP_KEY = '@notification_map'; // maps entity id -> notification ids

const DEFAULT_PREFS: NotificationPreferences = {
  medicationReminders: true,
  appointmentReminders: true,
  vaccinationAlerts: true,
  reminderLeadTimeMinutes: 60,
  soundEnabled: true,
  badgeEnabled: true,
};

// ─── Notification handler ─────────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => {
    const prefs = await getPreferences();
    return {
      shouldShowAlert: true,
      shouldPlaySound: prefs.soundEnabled,
      shouldSetBadge: prefs.badgeEnabled,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

// ─── Permissions ──────────────────────────────────────────────────────────────

export const requestPermissions = async (): Promise<boolean> => {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const checkPermissions = async (): Promise<boolean> => {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
};

// ─── Preferences ─────────────────────────────────────────────────────────────

export const getPreferences = async (): Promise<NotificationPreferences> => {
  const stored = await AsyncStorage.getItem(PREFS_KEY);
  return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
};

export const savePreferences = async (prefs: Partial<NotificationPreferences>): Promise<void> => {
  const current = await getPreferences();
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ ...current, ...prefs }));
};

// ─── Notification ID map helpers ─────────────────────────────────────────────

const getNotificationMap = async (): Promise<Record<string, string[]>> => {
  const stored = await AsyncStorage.getItem(NOTIFICATION_MAP_KEY);
  return stored ? JSON.parse(stored) : {};
};

const saveNotificationIds = async (entityId: string, notificationIds: string[]): Promise<void> => {
  const map = await getNotificationMap();
  map[entityId] = notificationIds;
  await AsyncStorage.setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
};

const removeNotificationId = async (entityId: string): Promise<void> => {
  const map = await getNotificationMap();
  delete map[entityId];
  await AsyncStorage.setItem(NOTIFICATION_MAP_KEY, JSON.stringify(map));
};

// ─── Medication reminders ─────────────────────────────────────────────────────

export const scheduleMedicationReminder = async (medication: Medication): Promise<string[]> => {
  const prefs = await getPreferences();
  if (!prefs.medicationReminders) return [];

  await cancelEntityNotification(medication.id);

  const startDate = new Date(medication.startDate);
  if (Number.isNaN(startDate.getTime())) return [];

  const now = new Date();
  const windowStart = startDate > now ? startDate : now;
  const windowEnd = new Date(windowStart);
  windowEnd.setDate(windowEnd.getDate() + 7);

  const intervalMs = medication.frequency * 60 * 60 * 1000;
  if (intervalMs <= 0) return [];

  const endDate = medication.endDate ? new Date(medication.endDate) : null;
  if (endDate && Number.isNaN(endDate.getTime())) return [];
  if (endDate && endDate < windowStart) return [];

  const lastDate = endDate && endDate < windowEnd ? endDate : windowEnd;
  const notificationIds: string[] = [];

  let currentDose = new Date(startDate);
  if (currentDose < windowStart) {
    const diff = windowStart.getTime() - currentDose.getTime();
    const steps = Math.ceil(diff / intervalMs);
    currentDose = new Date(currentDose.getTime() + steps * intervalMs);
  }

  while (currentDose <= lastDate) {
    if (currentDose > new Date()) {
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💊 Medication Reminder',
          body: `Time to give ${medication.name} (${medication.dosage})`,
          sound: prefs.soundEnabled ? 'default' : undefined,
          data: { type: 'medication' as NotificationGroup, medicationId: medication.id },
          categoryIdentifier: 'medication',
        },
        trigger: {
          type: 'date',
          date: currentDose,
        } as Notifications.DateTriggerInput,
      });
      notificationIds.push(notificationId);
    }
    currentDose = new Date(currentDose.getTime() + intervalMs);
  }

  await saveNotificationIds(medication.id, notificationIds);
  return notificationIds;
};

// ─── Appointment reminders ────────────────────────────────────────────────────

export const scheduleAppointmentNotification = async (
  appointment: Appointment,
): Promise<string> => {
  const prefs = await getPreferences();
  if (!prefs.appointmentReminders) return '';

  await cancelEntityNotification(appointment.id);

  const appointmentDate = new Date(appointment.date);
  const triggerDate = new Date(
    appointmentDate.getTime() - prefs.reminderLeadTimeMinutes * 60 * 1000,
  );

  if (triggerDate <= new Date()) return ''; // already past

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📅 Appointment Reminder',
      body: `${appointment.title}${appointment.location ? ` at ${appointment.location}` : ''} in ${prefs.reminderLeadTimeMinutes} min`,
      sound: prefs.soundEnabled ? 'default' : undefined,
      data: { type: 'appointment' as NotificationGroup, appointmentId: appointment.id },
      categoryIdentifier: 'appointment',
    },
    trigger: {
      type: 'date',
      date: triggerDate,
    } as Notifications.DateTriggerInput,
  });

  await saveNotificationIds(appointment.id, [notificationId]);
  return notificationId;
};

// ─── Vaccination reminders ────────────────────────────────────────────────────

export const scheduleVaccinationReminder = async (vaccination: Vaccination): Promise<string> => {
  const prefs = await getPreferences();
  if (!prefs.vaccinationAlerts) return '';

  await cancelEntityNotification(vaccination.id);

  const dueDate = new Date(vaccination.dueDate);
  if (dueDate <= new Date()) return '';

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Vaccination Reminder',
      body: `${vaccination.name} is due soon`,
      sound: prefs.soundEnabled ? 'default' : undefined,
      data: { type: 'vaccination' as NotificationGroup, vaccinationId: vaccination.id },
      categoryIdentifier: 'vaccination',
    },
    trigger: {
      type: 'date',
      date: dueDate,
    } as Notifications.DateTriggerInput,
  });

  await saveNotificationIds(vaccination.id, [notificationId]);
  return notificationId;
};

// ─── Alert helpers ───────────────────────────────────────────────────────────

export const sendAlertNotification = async (
  title: string,
  body: string,
  data: Record<string, unknown> = {},
): Promise<string> => {
  const prefs = await getPreferences();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: prefs.soundEnabled ? 'default' : undefined,
      data: { type: 'alert' as NotificationGroup, ...data },
      categoryIdentifier: 'alert',
    },
    trigger: null, // fire immediately
  });
  return notificationId;
};

// ─── Cancel helpers ───────────────────────────────────────────────────────────

export const cancelEntityNotification = async (entityId: string): Promise<void> => {
  const map = await getNotificationMap();
  const notificationIds = map[entityId] ?? [];
  await Promise.all(
    notificationIds.map((notificationId) =>
      Notifications.cancelScheduledNotificationAsync(notificationId),
    ),
  );
  await removeNotificationId(entityId);
};

export const cancelNotification = async (notificationId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
};

export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await AsyncStorage.removeItem(NOTIFICATION_MAP_KEY);
};

// ─── Grouping helpers ─────────────────────────────────────────────────────────

export const cancelGroupNotifications = async (
  group: NotificationGroup,
): Promise<Notifications.NotificationRequest[]> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = scheduled.filter(
    (n: Notifications.NotificationRequest) => n.content.data?.type === group,
  );
  await Promise.all(
    toCancel.map((n: Notifications.NotificationRequest) =>
      Notifications.cancelScheduledNotificationAsync(n.identifier),
    ),
  );
  return toCancel;
};

export const getScheduledByGroup = async (
  group: NotificationGroup,
): Promise<Notifications.NotificationRequest[]> => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.filter((n: Notifications.NotificationRequest) => n.content.data?.type === group);
};

export const getAllScheduled = async (): Promise<Notifications.NotificationRequest[]> => {
  return Notifications.getAllScheduledNotificationsAsync();
};
