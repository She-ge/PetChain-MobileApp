import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { logout, requestPasswordReset } from '../services/authService';
import LanguageSelector from '../components/LanguageSelector';
import {
  isBiometricAuthenticationAvailable,
  isBiometricAuthenticationEnabled,
  promptForBiometricSetup,
  disableBiometricAuthentication,
} from '../services/authService';
import { getUserProfile, updateUserProfile } from '../services/userService';
import type { NotificationPreferences, User } from '../models/User';

// ─── App version info ─────────────────────────────────────────────────────────
// Pulled from expo-constants at runtime; fallback to package values
let APP_VERSION = '1.0.0';
let BUILD_NUMBER = '1';
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Constants = require('expo-constants').default;
  APP_VERSION = Constants.expoConfig?.version ?? APP_VERSION;
  BUILD_NUMBER = String(Constants.expoConfig?.ios?.buildNumber ?? Constants.expoConfig?.android?.versionCode ?? BUILD_NUMBER);
} catch {
  // expo-constants unavailable in test/non-expo environments
}

const TERMS_URL = 'https://petchain.app/terms';
const PRIVACY_URL = 'https://petchain.app/privacy';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  /** Called after a successful logout so the parent can redirect to auth. */
  onLogout: () => void;
}

// ─── Change Password Modal ────────────────────────────────────────────────────

interface ChangePasswordModalProps {
  visible: boolean;
  email: string;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ visible, email, onClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('changePassword.noEmail'));
      return;
    }
    setLoading(true);
    try {
      await requestPasswordReset(email);
      Alert.alert(
        t('changePassword.emailSentTitle'),
        t('changePassword.emailSentBody'),
        [{ text: 'OK', onPress: onClose }],
      );
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('changePassword.failedSend'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('changePassword.title')}</Text>
          <Text style={styles.modalBody}>{t('changePassword.body')}</Text>
          <Text style={styles.modalEmail}>{email}</Text>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={() => void handleSend()}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t('changePassword.sendResetLink')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const SettingsScreen: React.FC<Props> = ({ onLogout }) => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    medicationReminders: true,
    appointmentReminders: true,
    vaccinationAlerts: true,
    soundEnabled: true,
    badgeEnabled: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // ── Load profile on mount ──────────────────────────────────────────────────

  useEffect(() => {
    void (async () => {
      const stored = await getUserProfile();
      if (stored) {
        setProfile(stored);
        setName(stored.name ?? '');
        setEmail(stored.email ?? '');
        setPhone(stored.phone ?? '');
        setNotifPrefs(prev => ({ ...prev, ...(stored.notificationPreferences ?? {}) }));
      }

      const available = await isBiometricAuthenticationAvailable();
      setBiometricAvailable(available);
      if (available) {
        const enabled = await isBiometricAuthenticationEnabled();
        setBiometricEnabled(enabled);
      }
    })();
  }, []);

  // ── Profile save ───────────────────────────────────────────────────────────

  const validateEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const handleSaveProfile = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('settings.nameRequired'));
      return;
    }
    if (email.trim() && !validateEmail(email)) {
      Alert.alert(t('common.error'), t('settings.invalidEmail'));
      return;
    }

    setProfileSaving(true);
    setProfileSaved(false);
    try {
      await updateUserProfile({ name: name.trim(), email: email.trim(), phone: phone.trim() });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('settings.failedSaveProfile'));
    } finally {
      setProfileSaving(false);
    }
  }, [name, email, phone, t]);

  // ── Notification toggle ────────────────────────────────────────────────────

  const handleNotifToggle = useCallback(
    async (key: keyof NotificationPreferences, value: boolean) => {
      const updated = { ...notifPrefs, [key]: value };
      setNotifPrefs(updated);
      setNotifSaving(true);
      try {
        await updateUserProfile({ notificationPreferences: updated });
      } catch {
        // Revert on failure
        setNotifPrefs(notifPrefs);
        Alert.alert(t('common.error'), t('settings.failedSaveNotif'));
      } finally {
        setNotifSaving(false);
      }
    },
    [notifPrefs],
  );

  // ── Biometric toggle ───────────────────────────────────────────────────────

  const handleBiometricToggle = useCallback(async (value: boolean) => {
    setBiometricLoading(true);
    try {
      if (value) {
        const success = await promptForBiometricSetup();
        setBiometricEnabled(success);
        if (!success) Alert.alert(t('common.error'), t('settings.biometricSetupFailed'));
      } else {
        await disableBiometricAuthentication();
        setBiometricEnabled(false);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Biometric setup failed.');
    } finally {
      setBiometricLoading(false);
    }
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────

  const handleLogout = useCallback(() => {
    Alert.alert(t('common.logoutConfirmTitle'), t('common.logoutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.logout'),
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
            onLogout();
          } catch {
            // Even if server-side logout fails, local tokens are cleared — proceed
            onLogout();
          }
        },
      },
    ]);
  }, [onLogout]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionHeader}>{title}</Text>
  );

  const RowSeparator = () => <View style={styles.separator} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>{t('settings.title')}</Text>

      {/* ── Profile Settings ── */}
      <SectionHeader title={t('settings.profile')} />
      <View style={styles.card}>
        <Text style={styles.label}>{t('settings.name')} *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('settings.namePlaceholder')}
          placeholderTextColor="#aaa"
          autoCapitalize="words"
        />

        <Text style={styles.label}>{t('settings.email')}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t('settings.emailPlaceholder')}
          placeholderTextColor="#aaa"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>{t('settings.phone')}</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder={t('settings.phonePlaceholder')}
          placeholderTextColor="#aaa"
          keyboardType="phone-pad"
        />

        {profileSaved && (
          <Text style={styles.successText}>{t('settings.profileSaved')}</Text>
        )}

        <TouchableOpacity
          style={[styles.btn, profileSaving && styles.btnDisabled]}
          onPress={() => void handleSaveProfile()}
          disabled={profileSaving}
        >
          {profileSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>{t('settings.saveProfile')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Notification Preferences ── */}
      <SectionHeader title={t('settings.notifications')} />
      <View style={styles.card}>
        {notifSaving && (
          <ActivityIndicator size="small" color="#4CAF50" style={styles.notifLoader} />
        )}

        {(
          [
            { key: 'medicationReminders', label: t('settings.medicationReminders') },
            { key: 'appointmentReminders', label: t('settings.appointmentReminders') },
            { key: 'vaccinationAlerts', label: t('settings.vaccinationAlerts') },
            { key: 'soundEnabled', label: t('settings.sound') },
            { key: 'badgeEnabled', label: t('settings.badgeCount') },
          ] as { key: keyof NotificationPreferences; label: string }[]
        ).map(({ key, label }, idx, arr) => (
          <React.Fragment key={key}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{label}</Text>
              <Switch
                value={Boolean(notifPrefs[key])}
                onValueChange={v => void handleNotifToggle(key, v)}
                trackColor={{ false: '#ddd', true: '#4CAF50' }}
                thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                disabled={notifSaving}
              />
            </View>
            {idx < arr.length - 1 && <RowSeparator />}
          </React.Fragment>
        ))}
      </View>

      {/* ── Security Settings ── */}
      <SectionHeader title={t('settings.security')} />
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.row}
          onPress={() => setShowChangePassword(true)}
        >
          <Text style={styles.rowLabel}>{t('settings.changePassword')}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>

        {biometricAvailable && (
          <>
            <RowSeparator />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('settings.biometricLogin')}</Text>
              {biometricLoading ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <Switch
                  value={biometricEnabled}
                  onValueChange={v => void handleBiometricToggle(v)}
                  trackColor={{ false: '#ddd', true: '#4CAF50' }}
                  thumbColor={Platform.OS === 'android' ? '#fff' : undefined}
                />
              )}
            </View>
          </>
        )}
      </View>

      {/* ── Language ── */}
      <SectionHeader title={t('settings.language')} />
      <View style={styles.card}>
        <LanguageSelector />
      </View>

      {/* ── App Information ── */}
      <SectionHeader title={t('settings.appInfo')} />
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.version')}</Text>
          <Text style={styles.rowValue}>{APP_VERSION}</Text>
        </View>
        <RowSeparator />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('settings.build')}</Text>
          <Text style={styles.rowValue}>{BUILD_NUMBER}</Text>
        </View>
        <RowSeparator />
        <TouchableOpacity
          style={styles.row}
          onPress={() => void Linking.openURL(TERMS_URL)}
        >
          <Text style={styles.rowLabel}>{t('settings.termsOfService')}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <RowSeparator />
        <TouchableOpacity
          style={styles.row}
          onPress={() => void Linking.openURL(PRIVACY_URL)}
        >
          <Text style={styles.rowLabel}>{t('settings.privacyPolicy')}</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity
        style={[styles.logoutBtn, loggingOut && styles.btnDisabled]}
        onPress={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? (
          <ActivityIndicator color="#d32f2f" />
        ) : (
          <Text style={styles.logoutText}>{t('common.logout')}</Text>
        )}
      </TouchableOpacity>

      {/* ── Change Password Modal ── */}
      <ChangePasswordModal
        visible={showChangePassword}
        email={email}
        onClose={() => setShowChangePassword(false)}
      />
    </ScrollView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  screenTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginTop: 12,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1a1a1a',
  },
  successText: {
    color: '#4CAF50',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
  },
  btn: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 15, color: '#1a1a1a' },
  rowValue: { fontSize: 15, color: '#888' },
  chevron: { fontSize: 20, color: '#bbb' },
  separator: { height: 1, backgroundColor: '#f0f0f0' },
  notifLoader: { alignSelf: 'flex-end', marginBottom: 4 },
  logoutBtn: {
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: '#d32f2f',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: '#d32f2f', fontSize: 16, fontWeight: '600' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  modalBody: { fontSize: 15, color: '#555', marginBottom: 6 },
  modalEmail: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 20 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#888', fontSize: 15 },
});

export default SettingsScreen;
