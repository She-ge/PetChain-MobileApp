import config from '../config';
import * as SecureStore from 'expo-secure-store';

const PIN_STORE_KEY = 'cert_pins_v1';

/**
 * Load pinned certs from secure store and config. Returns array of pin identifiers.
 */
export async function loadPins(): Promise<string[]> {
  try {
    const stored = await SecureStore.getItemAsync(PIN_STORE_KEY);
    const cfgPins = (config as any).api?.pins ?? [];
    const storedPins = stored ? JSON.parse(stored) : [];
    return Array.from(new Set([...cfgPins, ...storedPins]));
  } catch {
    return (config as any).api?.pins ?? [];
  }
}

/**
 * Persist new set of pins (used when rotating/updating pins)
 */
export async function savePins(pins: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(PIN_STORE_KEY, JSON.stringify(pins));
  } catch {
    // ignore
  }
}

/**
 * Optionally fetch pins from a remote management endpoint and update stored pins.
 * The endpoint is expected to return JSON { pins: string[] }.
 */
export async function refreshPinsFromRemote(): Promise<string[] | null> {
  const url = (config as any).api?.pinUrl;
  if (!url) return null;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return null;
    const body = await res.json();
    if (Array.isArray(body.pins)) {
      await savePins(body.pins);
      return body.pins;
    }
    return null;
  } catch {
    return null;
  }
}

export default {
  loadPins,
  savePins,
  refreshPinsFromRemote,
};
