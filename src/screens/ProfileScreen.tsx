import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import type { User, UserRole } from '../models/User';
import { getUserProfile, saveUserProfile, updateUserProfile } from '../services/userService';

const DEFAULT_FORM: Omit<User, 'id'> = {
  email: '',
  name: '',
  phone: '',
  role: 'owner',
  profilePhoto: '',
  address: {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
  },
  emergencyContact: {
    name: '',
    phone: '',
    relationship: '',
    email: '',
  },
  notificationPreferences: {
    medicationReminders: true,
    appointmentReminders: true,
    vaccinationAlerts: true,
    reminderLeadTimeMinutes: 60,
    soundEnabled: true,
    badgeEnabled: true,
  },
};

const ProfileScreen: React.FC = () => {
  const [profile, setProfile] = useState<Omit<User, 'id'>>(DEFAULT_FORM);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const stored = await getUserProfile();
      if (stored) {
        setExistingId(stored.id);
        setProfile({
          ...DEFAULT_FORM,
          ...stored,
          address: { ...DEFAULT_FORM.address, ...stored.address },
          emergencyContact: { ...DEFAULT_FORM.emergencyContact, ...stored.emergencyContact },
          notificationPreferences: {
            ...DEFAULT_FORM.notificationPreferences,
            ...stored.notificationPreferences,
          },
        });
      }
    })();
  }, []);

  const save = async () => {
    if (!profile.email.trim() || !profile.name.trim()) {
      Alert.alert('Validation', 'Name and email are required.');
      return;
    }

    try {
      const payload: User = {
        id: existingId ?? `user_${Date.now()}`,
        ...profile,
      };

      if (existingId) {
        await updateUserProfile(payload);
      } else {
        await saveUserProfile(payload);
        setExistingId(payload.id);
      }

      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error) {
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : 'Unable to save profile.',
      );
    }
  };

  const setPref = (
    key: keyof NonNullable<User['notificationPreferences']>,
    value: boolean | number,
  ) => {
    setProfile((current) => ({
      ...current,
      notificationPreferences: {
        ...current.notificationPreferences,
        [key]: value,
      },
    }));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>User Profile</Text>

      <TextInput
        style={styles.input}
        placeholder="Full name"
        value={profile.name}
        onChangeText={(value) => setProfile((current) => ({ ...current, name: value }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={profile.email}
        onChangeText={(value) => setProfile((current) => ({ ...current, email: value }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone"
        keyboardType="phone-pad"
        value={profile.phone}
        onChangeText={(value) => setProfile((current) => ({ ...current, phone: value }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Role (owner, vet, admin)"
        value={profile.role}
        onChangeText={(value) => setProfile((current) => ({ ...current, role: value as UserRole }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Profile photo URL"
        value={profile.profilePhoto}
        onChangeText={(value) => setProfile((current) => ({ ...current, profilePhoto: value }))}
      />

      <Text style={styles.sectionTitle}>Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Street"
        value={profile.address?.street ?? ''}
        onChangeText={(value) =>
          setProfile((current) => ({
            ...current,
            address: { ...current.address, street: value },
          }))
        }
      />
      <TextInput
        style={styles.input}
        placeholder="City"
        value={profile.address?.city ?? ''}
        onChangeText={(value) =>
          setProfile((current) => ({
            ...current,
            address: { ...current.address, city: value },
          }))
        }
      />
      <TextInput
        style={styles.input}
        placeholder="State"
        value={profile.address?.state ?? ''}
        onChangeText={(value) =>
          setProfile((current) => ({
            ...current,
            address: { ...current.address, state: value },
          }))
        }
      />
      <TextInput
        style={styles.input}
        placeholder="Postal code"
        value={profile.address?.postalCode ?? ''}
        onChangeText={(value) =>
          setProfile((current) => ({
            ...current,
            address: { ...current.address, postalCode: value },
          }))
        }
      />
      <TextInput
        style={styles.input}
        placeholder="Country"
        value={profile.address?.country ?? ''}
        onChangeText={(value) =>
          setProfile((current) => ({
            ...current,
            address: { ...current.address, country: value },
          }))
        }
      />

      <Text style={styles.sectionTitle}>Emergency Contact</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={profile.emergencyContact?.name ?? ''}
        onChangeText={(value) =>
          setProfile((current) => ({
            ...current,
            emergencyContact: { ...current.emergencyContact, name: value },
          }))
        }
      />
      <TextInput
        style={styles.input}
        placeholder="Phone"
        keyboardType="phone-pad"
        value={profile.emergencyContact?.phone ?? ''}
        onChangeText={(value) =>
          setProfile((current) => ({
            ...current,
            emergencyContact: { ...current.emergencyContact, phone: value },
          }))
        }
      />
      <TextInput
        style={styles.input}
        placeholder="Relationship"
        value={profile.emergencyContact?.relationship ?? ''}
        onChangeText={(value) =>
          setProfile((current) => ({
            ...current,
            emergencyContact: { ...current.emergencyContact, relationship: value },
          }))
        }
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={profile.emergencyContact?.email ?? ''}
        onChangeText={(value) =>
          setProfile((current) => ({
            ...current,
            emergencyContact: { ...current.emergencyContact, email: value },
          }))
        }
      />

      <Text style={styles.sectionTitle}>Notification Preferences</Text>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Medication reminders</Text>
        <Switch
          value={profile.notificationPreferences?.medicationReminders ?? true}
          onValueChange={(value) => setPref('medicationReminders', value)}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Appointment reminders</Text>
        <Switch
          value={profile.notificationPreferences?.appointmentReminders ?? true}
          onValueChange={(value) => setPref('appointmentReminders', value)}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Vaccination alerts</Text>
        <Switch
          value={profile.notificationPreferences?.vaccinationAlerts ?? true}
          onValueChange={(value) => setPref('vaccinationAlerts', value)}
        />
      </View>
      <TextInput
        style={styles.input}
        placeholder="Reminder lead time (minutes)"
        keyboardType="numeric"
        value={String(profile.notificationPreferences?.reminderLeadTimeMinutes ?? 60)}
        onChangeText={(value) => setPref('reminderLeadTimeMinutes', Number(value) || 60)}
      />
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Sound enabled</Text>
        <Switch
          value={profile.notificationPreferences?.soundEnabled ?? true}
          onValueChange={(value) => setPref('soundEnabled', value)}
        />
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Badge enabled</Text>
        <Switch
          value={profile.notificationPreferences?.badgeEnabled ?? true}
          onValueChange={(value) => setPref('badgeEnabled', value)}
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 18, paddingBottom: 36 },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 20, color: '#111' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 10, color: '#333' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  switchLabel: { fontSize: 14, color: '#333', flex: 1, marginRight: 8 },
  saveButton: {
    marginTop: 18,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default ProfileScreen;
