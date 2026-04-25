import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { User, UserRole } from "../models/User";
import {
  getUserProfile,
  saveUserProfile,
  updateUserProfile,
} from "../services/userService";
import { useSecureScreen } from "../utils/secureScreen";

const DEFAULT_FORM: Omit<User, "id"> = {
  email: "",
  name: "",
  phone: "",
  role: "owner",
  profilePhoto: "",
  address: { street: "", city: "", state: "", postalCode: "", country: "" },
  emergencyContact: { name: "", phone: "", relationship: "", email: "" },
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
  useSecureScreen();

  const [profile, setProfile] = useState<Omit<User, "id">>(DEFAULT_FORM);
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
          emergencyContact: {
            ...DEFAULT_FORM.emergencyContact,
            ...stored.emergencyContact,
          },
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
      Alert.alert("Validation", "Name and email are required.");
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
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "Unable to save profile.",
      );
    }
  };

  const setPref = (
    key: keyof NonNullable<User["notificationPreferences"]>,
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
        onChangeText={(value) => setProfile((c) => ({ ...c, name: value }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        value={profile.email}
        onChangeText={(value) => setProfile((c) => ({ ...c, email: value }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Phone"
        keyboardType="phone-pad"
        value={profile.phone}
        onChangeText={(value) => setProfile((c) => ({ ...c, phone: value }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Role (owner, vet, admin)"
        value={profile.role}
        onChangeText={(value) =>
          setProfile((c) => ({ ...c, role: value as UserRole }))
        }
      />
      <TextInput
        style={styles.input}
        placeholder="Profile photo URL"
        value={profile.profilePhoto}
        onChangeText={(value) =>
          setProfile((c) => ({ ...c, profilePhoto: value }))
        }
      />

      <Text style={styles.sectionTitle}>Address</Text>
      {(["street", "city", "state", "postalCode", "country"] as const).map(
        (field) => (
          <TextInput
            key={field}
            style={styles.input}
            placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
            value={profile.address?.[field] ?? ""}
            onChangeText={(value) =>
              setProfile((c) => ({
                ...c,
                address: { ...c.address, [field]: value },
              }))
            }
          />
        ),
      )}

      <Text style={styles.sectionTitle}>Emergency Contact</Text>
      {(["name", "phone", "relationship", "email"] as const).map((field) => (
        <TextInput
          key={field}
          style={styles.input}
          placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
          keyboardType={
            field === "phone"
              ? "phone-pad"
              : field === "email"
                ? "email-address"
                : "default"
          }
          value={profile.emergencyContact?.[field] ?? ""}
          onChangeText={(value) =>
            setProfile((c) => ({
              ...c,
              emergencyContact: { ...c.emergencyContact, [field]: value },
            }))
          }
        />
      ))}

      <Text style={styles.sectionTitle}>Notification Preferences</Text>
      {(
        [
          "medicationReminders",
          "appointmentReminders",
          "vaccinationAlerts",
          "soundEnabled",
          "badgeEnabled",
        ] as const
      ).map((key) => (
        <View key={key} style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            {key.replace(/([A-Z])/g, " $1").trim()}
          </Text>
          <Switch
            value={(profile.notificationPreferences?.[key] as boolean) ?? true}
            onValueChange={(value) => setPref(key, value)}
          />
        </View>
      ))}
      <TextInput
        style={styles.input}
        placeholder="Reminder lead time (minutes)"
        keyboardType="numeric"
        value={String(
          profile.notificationPreferences?.reminderLeadTimeMinutes ?? 60,
        )}
        onChangeText={(value) =>
          setPref("reminderLeadTimeMinutes", Number(value) || 60)
        }
      />

      <TouchableOpacity style={styles.saveButton} onPress={save}>
        <Text style={styles.saveButtonText}>Save Profile</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 18, paddingBottom: 36 },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 20, color: "#111" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 10,
    color: "#333",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 14,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },
  switchLabel: { fontSize: 14, color: "#333", flex: 1, marginRight: 8 },
  saveButton: {
    marginTop: 18,
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

export default ProfileScreen;
