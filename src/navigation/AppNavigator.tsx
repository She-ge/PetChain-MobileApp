import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import type { RootStackParamList, MainTabParamList, PetStackParamList } from './types';
import { DEEP_LINK_PREFIX } from './types';
import type { Pet } from '../models/Pet';
import MedicalRecordSearchScreen from '../screens/MedicalRecordSearchScreen';
import AuthNavigator from '../screens/AuthNavigator';
import EmergencyContactsScreen from '../screens/EmergencyContactsScreen';
import ManualEntryScreen from '../screens/ManualEntryScreen';
import MedicationScreen from '../screens/MedicationScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import PetDetailScreen from '../screens/PetDetailScreen';
import PetFormScreen from '../screens/PetFormScreen';
import PetListScreen from '../screens/PetListScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QRScannerScreen from '../screens/QRScannerScreen';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const PetStack = createNativeStackNavigator<PetStackParamList>();

// ─── Pet Stack ────────────────────────────────────────────────────────────────
function PetNavigator() {
  return (
    <PetStack.Navigator>
      <PetStack.Screen name="PetListScreen" options={{ title: 'My Pets' }}>
        {({ navigation }) => (
          <PetListScreen
            onSelectPet={(pet) => navigation.navigate('PetDetail', { petId: pet.id })}
            onAddPet={() => navigation.navigate('PetForm', {})}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetDetail" options={{ title: 'Pet Details' }}>
        {({ route, navigation }) => (
          <PetDetailScreen
            petId={route.params.petId}
            onBack={() => navigation.goBack()}
            onEdit={(pet: Pet) => navigation.navigate('PetForm', { pet })}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="PetForm" options={{ title: 'Pet Form' }}>
        {({ route, navigation }) => (
          <PetFormScreen
            pet={route.params?.pet}
            ownerId={route.params?.ownerId}
            onBack={() => navigation.goBack()}
            onSaved={() => navigation.goBack()}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="MedicalRecordSearch" options={{ title: 'Search Records' }}>
        {({ route, navigation }) => (
          <MedicalRecordSearchScreen
            petId={route.params.petId}
            onBack={() => navigation.goBack()}
          />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="NotificationPreferences" options={{ title: 'Notification Preferences' }}>
        {({ navigation }) => (
          <NotificationPreferencesScreen onBack={() => navigation.goBack()} />
        )}
      </PetStack.Screen>
      <PetStack.Screen name="DeleteAccount" options={{ title: 'Delete Account' }}>
        {({ navigation }) => (
          <DeleteAccountScreen
            onBack={() => navigation.goBack()}
            onDeleted={() => navigation.getParent()?.getParent()?.reset({ index: 0, routes: [{ name: 'Auth' }] })}
          />
        )}
      </PetStack.Screen>
    </PetStack.Navigator>
  );
}

// ─── Main Tabs ────────────────────────────────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="PetList"
        component={PetNavigator}
        options={{ title: 'Pets', headerShown: false }}
      />
      <Tab.Screen
        name="Medications"
        component={MedicationScreen}
        options={{ title: 'Medications' }}
      />
      <Tab.Screen
        name="Emergency"
        component={EmergencyContactsScreen}
        options={{ title: 'Emergency' }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ─── Deep linking ─────────────────────────────────────────────────────────────
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: DEEP_LINK_PREFIX,
  config: {
    screens: {
      Onboarding: 'onboarding',
      Auth: 'auth',
      Main: {
        screens: {
          PetList: {
            screens: {
              PetListScreen: 'pets',
              PetDetail: 'pets/:petId',
              PetForm: 'pets/form/:petId?',
            },
          },
          Medications: 'medications',
          Emergency: 'emergency',
          Profile: 'profile',
        },
      },
      QRScanner: 'scan',
      ManualEntry: 'manual-entry',
    },
  },
};

// ─── Root Navigator ───────────────────────────────────────────────────────────
export default function AppNavigator() {
  return (
    <NavigationContainer linking={linking}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Onboarding">
          {({ navigation }) => (
            <OnboardingScreen
              onComplete={() => navigation.replace('Auth')}
              onSkip={() => navigation.replace('Auth')}
            />
          )}
        </RootStack.Screen>

        <RootStack.Screen name="Auth">
          {({ navigation }) => <AuthNavigator onAuthenticated={() => navigation.replace('Main')} />}
        </RootStack.Screen>

        <RootStack.Screen name="Main" component={MainTabs} />

        {/* Modals */}
        <RootStack.Group screenOptions={{ presentation: 'modal' }}>
          <RootStack.Screen name="QRScanner">
            {({ navigation }) => (
              <QRScannerScreen
                onScanSuccess={() => navigation.goBack()}
                onClose={() => navigation.goBack()}
                onManualEntry={() => navigation.replace('ManualEntry')}
              />
            )}
          </RootStack.Screen>
          <RootStack.Screen name="ManualEntry">
            {({ navigation }) => (
              <ManualEntryScreen
                onSubmit={() => navigation.goBack()}
                onClose={() => navigation.goBack()}
              />
            )}
          </RootStack.Screen>
        </RootStack.Group>
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
