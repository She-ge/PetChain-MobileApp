import { getItem, setItem, removeItem } from '../localDB';
import { getUserProfile, saveUserProfile, updateUserProfile, clearUserProfile } from '../userService';
import { savePreferences } from '../notificationService';

jest.mock('../localDB', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('../notificationService', () => ({
  savePreferences: jest.fn(),
}));

describe('userService', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
    notificationPreferences: {
      medicationReminders: true,
      appointmentReminders: true,
      vaccinationAlerts: true,
      reminderLeadTimeMinutes: 60,
      soundEnabled: true,
      badgeEnabled: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserProfile', () => {
    it('should return parsed user profile if it exists', async () => {
      (getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));
      const profile = await getUserProfile();
      expect(profile).toEqual(mockUser);
    });

    it('should return null if no profile exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      const profile = await getUserProfile();
      expect(profile).toBeNull();
    });
  });

  describe('saveUserProfile', () => {
    it('should save user profile with default notification preferences', async () => {
      const userToSave = { id: 'user-123', email: 'test@example.com' };
      const savedUser = await saveUserProfile(userToSave as any);

      expect(setItem).toHaveBeenCalledWith(
        '@user_profile',
        expect.stringContaining('"email":"test@example.com"')
      );
      expect(savePreferences).toHaveBeenCalledWith(savedUser.notificationPreferences);
      expect(savedUser.notificationPreferences?.medicationReminders).toBe(true);
    });
  });

  describe('updateUserProfile', () => {
    it('should update existing profile', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));
      const updates = { firstName: 'Jane' };
      
      const updated = await updateUserProfile(updates);

      expect(updated.firstName).toBe('Jane');
      expect(updated.lastName).toBe('Doe');
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    it('should throw error if no profile exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await expect(updateUserProfile({ firstName: 'Jane' })).rejects.toThrow('No user profile exists to update');
    });

    it('should update notification preferences and call savePreferences', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));
      const updates = { notificationPreferences: { medicationReminders: false } };
      
      const updated = await updateUserProfile(updates as any);

      expect(updated.notificationPreferences?.medicationReminders).toBe(false);
      expect(savePreferences).toHaveBeenCalled();
    });
  });

  describe('clearUserProfile', () => {
    it('should remove profile from AsyncStorage', async () => {
      await clearUserProfile();
      expect(removeItem).toHaveBeenCalledWith('@user_profile');
    });
  });
});
