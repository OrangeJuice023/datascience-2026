import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Where the app looks for the SIGMA API.
 *
 * The base URL is a setting, not a constant: a reviewer running the app
 * against a local server, a staging deployment, or a production deployment
 * all need different values, and the app must say which one it is talking
 * to rather than hiding it.
 *
 * Resolution order:
 *  1. A value the user saved in Settings.
 *  2. `EXPO_PUBLIC_API_BASE_URL` from the environment.
 *  3. A platform-appropriate localhost default.
 */

const STORAGE_KEY = 'sigma.apiBaseUrl';

/**
 * `10.0.2.2` is the Android emulator's alias for the host machine's
 * loopback interface, so `localhost` there would mean the emulator itself.
 */
const LOCALHOST = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const DEFAULT_BASE_URL = `${LOCALHOST}/api/v1`;

export function defaultBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  return fromEnv ? fromEnv : DEFAULT_BASE_URL;
}

/** Strips trailing slashes so paths can be joined safely. */
export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export async function loadStoredBaseUrl(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function storeBaseUrl(value: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, normalizeBaseUrl(value));
}

export async function clearStoredBaseUrl(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

/** Validates a user-entered base URL before it is saved. */
export function validateBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return 'Enter a base URL.';
  if (!/^https?:\/\//i.test(trimmed)) return 'The URL must start with http:// or https://.';
  try {
    new URL(trimmed);
  } catch {
    return 'That is not a valid URL.';
  }
  return null;
}
