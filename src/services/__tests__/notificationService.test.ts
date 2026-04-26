import { getItem, setItem } from '../localDB';
import * as Notifications from 'expo-notifications';
import { 
  requestPermissions, 
  checkPermissions, 
  getPreferences, 
  savePreferences,
  scheduleMedicationReminders,
  cancelEntityReminders
} from '../notificationService';

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
}));

describe('notificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('permissions', () => {
    it('should return true if granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      expect(await checkPermissions()).toBe(true);
    });

    it('should request permissions if not granted', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'undetermined' });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
      expect(await requestPermissions()).toBe(true);
      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    });
  });

  describe('preferences', () => {
    it('should return default preferences if none stored', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);
      const prefs = await getPreferences();
      expect(prefs.medicationReminders).toBe(true);
    });

    it('should save preferences', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify({ medicationReminders: true }));
      await savePreferences({ medicationReminders: false });
      expect(setItem).toHaveBeenCalledWith(
        '@notification_preferences',
        expect.stringContaining('"medicationReminders":false')
      );
    });
  });

  describe('scheduling', () => {
    const mockMedication = {
      id: 'med-123',
      name: 'Aspirin',
      dosage: '10mg',
      frequency: 8,
      startDate: new Date().toISOString(),
    };

    it('should schedule medication reminders', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id-123');
      
      await scheduleMedicationReminders(mockMedication);
      
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      expect(setItem).toHaveBeenCalledWith(
        '@notification_map',
        expect.stringContaining('notif-id-123')
      );
    });

    it('should cancel existing reminders before scheduling new ones', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 'med-123': ['old-id'] }));
      
      await scheduleMedicationReminders(mockMedication);
      
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-id');
    });

    it('should cancel all reminders for an entity', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 'med-123': ['id1', 'id2'] }));
      
      await cancelEntityReminders('med-123');
      
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(setItem).toHaveBeenCalledWith('@notification_map', '{}');
    });
  });

  describe('mapping', () => {
    it('should return empty array if no mapping exists', async () => {
      (getItem as jest.Mock).mockResolvedValue(null);
      const ids = await getNotificationIds('med-123');
      expect(ids).toEqual([]);
    });

    it('should add to existing mapping', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 'med-123': ['old-id'] }));
      await addNotificationId('med-123', 'new-id');
      expect(setItem).toHaveBeenCalledWith(
        '@notification_map',
        expect.stringContaining('"new-id"')
      );
    });

    it('should clear mapping', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 'med-123': ['id1', 'id2'] }));
      await clearNotificationIds('med-123');
      expect(setItem).toHaveBeenCalledWith('@notification_map', '{}');
    });
  });
});
