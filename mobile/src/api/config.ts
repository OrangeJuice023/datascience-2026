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
 *  1. A value the user saved in Settings, if it answers (see `chooseBaseUrl`).
 *  2. `EXPO_PUBLIC_API_BASE_URL` from the environment.
 *  3. In a development build, a platform-appropriate localhost default; in
 *     an installed (release) build, the deployed API, so an APK works on its
 *     own even when it was built without the EAS environment.
 */

const STORAGE_KEY = 'sigma.apiBaseUrl';

/**
 * `10.0.2.2` is the Android emulator's alias for the host machine's
 * loopback interface, so `localhost` there would mean the emulator itself.
 */
const LOCALHOST = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export const DEFAULT_BASE_URL = `${LOCALHOST}/api/v1`;

/** The deployed API that preview and production builds talk to. */
export const DEPLOYED_BASE_URL = 'https://datascience-2026.vercel.app/api/v1';

/** `__DEV__` is set by React Native; it is undefined under the test runner. */
function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function defaultBaseUrl(dev: boolean = isDevBuild()): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (fromEnv && !(isLoopbackUrl(fromEnv) && !dev)) return fromEnv;
  return dev ? DEFAULT_BASE_URL : DEPLOYED_BASE_URL;
}

/**
 * True for addresses that only mean something on a developer's machine:
 * localhost, 127.x, the Android emulator's host alias and `0.0.0.0`. On a
 * phone these point at the phone itself, so an installed build never uses
 * them.
 */
export function isLoopbackUrl(value: string): boolean {
  try {
    const host = new URL(value.trim()).hostname.replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '10.0.2.2' || host === '0.0.0.0' || host === '::1' || /^127\./.test(host);
  } catch {
    return false;
  }
}

export interface BaseUrlChoice {
  baseUrl: string;
  /** The saved address that was passed over, when the app fell back to the default. */
  skipped: string | null;
  /** True when the saved address should be deleted, not just passed over. */
  clearStored: boolean;
}

/**
 * Picks the address the app starts with, so it connects without the user
 * touching Settings.
 *
 * - No saved address: the default.
 * - A saved loopback address in an installed build: it can never work on a
 *   phone, so it is dropped for the default.
 * - A saved address that does not answer while the default does: the
 *   default is used for this session. The saved value is kept, so a LAN
 *   server that is just switched off is tried again next launch.
 * - Neither answers: the saved address stays, so the error the user sees
 *   names the address they chose.
 */
export async function chooseBaseUrl(
  stored: string | null,
  fallback: string,
  probe: (baseUrl: string) => Promise<boolean>,
  dev: boolean = isDevBuild()
): Promise<BaseUrlChoice> {
  const saved = stored ? normalizeBaseUrl(stored) : '';
  if (!saved || saved === fallback) return { baseUrl: fallback, skipped: null, clearStored: false };
  if (!dev && isLoopbackUrl(saved)) return { baseUrl: fallback, skipped: saved, clearStored: true };
  if (await probe(saved)) return { baseUrl: saved, skipped: null, clearStored: false };
  if (await probe(fallback)) return { baseUrl: fallback, skipped: saved, clearStored: false };
  return { baseUrl: saved, skipped: null, clearStored: false };
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
