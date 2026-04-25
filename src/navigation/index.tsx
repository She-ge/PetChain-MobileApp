import React, { lazy } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LazyScreen from '../components/LazyScreen';

// --- Lazy imports: each screen is a separate chunk loaded on demand ---

// Auth stack — loaded immediately on launch (critical path)
const LoginScreen = lazy(() => import('../screens/auth/LoginScreen'));
const RegisterScreen = lazy(() => import('../screens/auth/RegisterScreen'));

// Main stack — loaded only after auth, non-blocking on launch
const HomeScreen = lazy(() => import('../screens/home/HomeScreen'));
const PetProfileScreen = lazy(() => import('../screens/pet/PetProfileScreen'));
const MedicalRecordsScreen = lazy(() => import('../screens/medical/MedicalRecordsScreen'));
const AppointmentsScreen = lazy(() => import('../screens/appointments/AppointmentsScreen'));

// Heavy / non-critical screens — loaded only when navigated to
const QRScannerScreen = lazy(() => import('../screens/qr/QRScannerScreen'));
const EmergencyScreen = lazy(() => import('../screens/emergency/EmergencyScreen'));
const MedicationScreen = lazy(() => import('../screens/medication/MedicationScreen'));

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Home: undefined;
  PetProfile: { petId: string };
  MedicalRecords: { petId: string };
  Appointments: { petId: string };
  QRScanner: undefined;
  Emergency: undefined;
  Medication: { petId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        {/* Auth — critical, loaded first */}
        <Stack.Screen name="Login">
          {(props) => (
            <LazyScreen>
              <LoginScreen {...props} />
            </LazyScreen>
          )}
        </Stack.Screen>

        <Stack.Screen name="Register">
          {(props) => (
            <LazyScreen>
              <RegisterScreen {...props} />
            </LazyScreen>
          )}
        </Stack.Screen>

        {/* Main — deferred until post-auth */}
        <Stack.Screen name="Home">
          {(props) => (
            <LazyScreen>
              <HomeScreen {...props} />
            </LazyScreen>
          )}
        </Stack.Screen>

        <Stack.Screen name="PetProfile">
          {(props) => (
            <LazyScreen>
              <PetProfileScreen {...props} />
            </LazyScreen>
          )}
        </Stack.Screen>

        <Stack.Screen name="MedicalRecords">
          {(props) => (
            <LazyScreen>
              <MedicalRecordsScreen {...props} />
            </LazyScreen>
          )}
        </Stack.Screen>

        <Stack.Screen name="Appointments">
          {(props) => (
            <LazyScreen>
              <AppointmentsScreen {...props} />
            </LazyScreen>
          )}
        </Stack.Screen>

        {/* Heavy / non-critical — only loaded when navigated to */}
        <Stack.Screen name="QRScanner">
          {(props) => (
            <LazyScreen>
              <QRScannerScreen {...props} />
            </LazyScreen>
          )}
        </Stack.Screen>

        <Stack.Screen name="Emergency">
          {(props) => (
            <LazyScreen>
              <EmergencyScreen {...props} />
            </LazyScreen>
          )}
        </Stack.Screen>

        <Stack.Screen name="Medication">
          {(props) => (
            <LazyScreen>
              <MedicationScreen {...props} />
            </LazyScreen>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
