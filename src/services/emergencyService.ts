import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { Linking, Platform, PermissionsAndroid } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  address?: string;
  type: 'vet' | 'clinic' | 'emergency' | 'poison-control';
  available24h?: boolean;
  notes?: string;
}

export interface VetClinic {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  latitude: number;
  longitude: number;
  distance?: number; // km
  rating?: number;
  available24h?: boolean;
}

export interface Location {
  latitude: number;
  longitude: number;
}

export interface SOSPayload {
  location: Location;
  timestamp: number;
  message?: string;
}

// ─── Storage keys ─────────────────────────────────────────────────────────────

const CONTACTS_KEY = '@emergency_contacts';
const FAVORITES_KEY = '@emergency_favorites';

// ─── Default contacts ─────────────────────────────────────────────────────────

const DEFAULT_CONTACTS: EmergencyContact[] = [
  {
    id: 'default-1',
    name: 'Pet Poison Helpline',
    phoneNumber: '855-764-7661',
    type: 'poison-control',
    available24h: true,
    notes: 'Fee may apply',
  },
  {
    id: 'default-2',
    name: 'ASPCA Animal Poison Control',
    phoneNumber: '888-426-4435',
    type: 'poison-control',
    available24h: true,
    notes: 'Fee may apply',
  },
];

// ─── EmergencyService ─────────────────────────────────────────────────────────

class EmergencyService {
  private static instance: EmergencyService;

  static getInstance(): EmergencyService {
    if (!EmergencyService.instance) {
      EmergencyService.instance = new EmergencyService();
    }
    return EmergencyService.instance;
  }

  // ── Contacts CRUD ────────────────────────────────────────────────────────────

  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    const stored = await AsyncStorage.getItem(CONTACTS_KEY);
    if (stored) return JSON.parse(stored);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(DEFAULT_CONTACTS));
    return DEFAULT_CONTACTS;
  }

  async addContact(contact: Omit<EmergencyContact, 'id'>): Promise<EmergencyContact> {
    const contacts = await this.getEmergencyContacts();
    const newContact: EmergencyContact = {
      ...contact,
      id: `contact_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    };
    contacts.push(newContact);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    return newContact;
  }

  async updateContact(
    id: string,
    updates: Partial<Omit<EmergencyContact, 'id'>>,
  ): Promise<EmergencyContact> {
    const contacts = await this.getEmergencyContacts();
    const idx = contacts.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Contact not found');
    contacts[idx] = { ...contacts[idx], ...updates };
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
    return contacts[idx];
  }

  async deleteContact(id: string): Promise<void> {
    const contacts = await this.getEmergencyContacts();
    const filtered = contacts.filter((c) => c.id !== id);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(filtered));
    // Also remove from favorites if present
    await this.removeFavoriteContact(id);
  }

  // ── Favorites ────────────────────────────────────────────────────────────────

  async getFavoriteContacts(): Promise<EmergencyContact[]> {
    const stored = await AsyncStorage.getItem(FAVORITES_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  async saveFavoriteContact(contact: EmergencyContact): Promise<void> {
    const favorites = await this.getFavoriteContacts();
    if (!favorites.find((f) => f.id === contact.id)) {
      favorites.push(contact);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    }
  }

  async removeFavoriteContact(contactId: string): Promise<void> {
    const favorites = await this.getFavoriteContacts();
    await AsyncStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(favorites.filter((f) => f.id !== contactId)),
    );
  }

  // ── Location ─────────────────────────────────────────────────────────────────

  async requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'PetChain needs your location to find nearby vet clinics.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true; // iOS prompts automatically via Geolocation.getCurrentPosition
  }

  async getCurrentLocation(): Promise<Location> {
    const hasPermission = await this.requestLocationPermission();
    if (!hasPermission) throw new Error('Location permission denied');

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          }),
        () => reject(new Error('Failed to get location')),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    });
  }

  // ── Nearby clinics ───────────────────────────────────────────────────────────

  async getNearbyVetClinics(
    latitude: number,
    longitude: number,
    radiusKm = 10,
  ): Promise<VetClinic[]> {
    // Mock data — replace with a real Places API call (e.g. Google Places)
    const mockClinics: VetClinic[] = [
      {
        id: 'clinic-1',
        name: 'Emergency Vet Clinic',
        address: '123 Main St',
        phoneNumber: '555-0100',
        latitude: latitude + 0.01,
        longitude: longitude + 0.01,
        available24h: true,
        rating: 4.5,
      },
      {
        id: 'clinic-2',
        name: 'City Animal Hospital',
        address: '456 Oak Ave',
        phoneNumber: '555-0200',
        latitude: latitude - 0.02,
        longitude: longitude - 0.02,
        available24h: false,
        rating: 4.8,
      },
      {
        id: 'clinic-3',
        name: 'PetCare 24/7',
        address: '789 Elm Rd',
        phoneNumber: '555-0300',
        latitude: latitude + 0.03,
        longitude: longitude - 0.01,
        available24h: true,
        rating: 4.2,
      },
    ];

    return mockClinics
      .map((clinic) => ({
        ...clinic,
        distance: this.calculateDistance(latitude, longitude, clinic.latitude, clinic.longitude),
      }))
      .filter((clinic) => clinic.distance! <= radiusKm)
      .sort((a, b) => a.distance! - b.distance!);
  }

  // ── SOS ──────────────────────────────────────────────────────────────────────

  /**
   * One-tap SOS: gets current location, calls the first available 24h contact,
   * and returns the SOS payload for further handling (e.g. sending to a backend).
   */
  async triggerSOS(message?: string): Promise<SOSPayload> {
    const location = await this.getCurrentLocation();
    const payload: SOSPayload = {
      location,
      timestamp: Date.now(),
      message,
    };

    // Auto-call first 24h emergency contact
    const contacts = await this.getEmergencyContacts();
    const emergencyContact = contacts.find((c) => c.available24h);
    if (emergencyContact) {
      this.callContact(emergencyContact.phoneNumber);
    }

    return payload;
  }

  // ── Call / Navigate ──────────────────────────────────────────────────────────

  callContact(phoneNumber: string): void {
    const url = `tel:${phoneNumber}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
    });
  }

  navigateToClinic(address: string): void {
    const encoded = encodeURIComponent(address);
    const url = Platform.select({
      ios: `maps:0,0?q=${encoded}`,
      android: `geo:0,0?q=${encoded}`,
    });

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        Linking.openURL(
          supported ? url : `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        );
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}

export default EmergencyService.getInstance();
