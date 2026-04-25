import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { 
  requestPermissions, 
  checkPermissions, 
  getPreferences, 
  savePreferences,
  scheduleMedicationReminders,
  cancelEntityReminders
} from '../notificationService';

jest.mock('@react-native-async-storage/async-storage', () => ({
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
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const prefs = await getPreferences();
      expect(prefs.medicationReminders).toBe(true);
    });

    it('should save preferences', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ medicationReminders: true }));
      await savePreferences({ medicationReminders: false });
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
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
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValue('notif-id-123');
      
      await scheduleMedicationReminders(mockMedication);
      
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@notification_map',
        expect.stringContaining('notif-id-123')
      );
    });

    it('should cancel existing reminders before scheduling new ones', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 'med-123': ['old-id'] }));
      
      await scheduleMedicationReminders(mockMedication);
      
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-id');
    });

    it('should cancel all reminders for an entity', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({ 'med-123': ['id1', 'id2'] }));
      
      await cancelEntityReminders('med-123');
      
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('@notification_map', '{}');
    });
  });
});
