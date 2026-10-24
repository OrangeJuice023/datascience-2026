import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { apiRequest } from '@/api/client';
import { clearStoredBaseUrl, defaultBaseUrl, isLoopbackUrl, loadStoredBaseUrl, normalizeBaseUrl, storeBaseUrl } from '@/api/config';
import { candidateBaseUrls, discoverBaseUrl, PROBE_TIMEOUT_MS, type CandidateSource } from '@/api/discovery';

/**
 * The API address the app talks to.
 *
 * The value is shared by every screen, so changing it in Settings changes
 * the whole app at once. It is also shown on the Overview screen, because
 * an app that silently points somewhere else is impossible to trust.
 *
 * With no saved address the app finds one by itself (api/discovery.ts):
 * the build's address, the development machine, the emulator host, then
 * the deployed API, whichever answers /health first in that order. `source`
 * says which one it is, so the choice is never hidden.
 */

export type BaseUrlSource = CandidateSource | 'saved' | 'unreachable';

interface SettingsContextValue {
  baseUrl: string;
  /** Where `baseUrl` came from. */
  source: BaseUrlSource;
  /** False until the saved value has been read and, without one, discovery has finished. */
  ready: boolean;
  /** The value the app falls back to when no candidate answers. */
  defaultBaseUrl: string;
  updateBaseUrl: (value: string) => Promise<void>;
  /** Forget the saved address and find one automatically again. */
  resetBaseUrl: () => Promise<void>;
  /** Run discovery again (e.g. after starting the local server). */
  rediscover: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

async function probe(url: string): Promise<boolean> {
  const response = await apiRequest<{ status?: string }>(url, '/health', { timeoutMs: PROBE_TIMEOUT_MS });
  return typeof response.data?.status === 'string';
}

async function discover(): Promise<{ url: string; source: BaseUrlSource } | null> {
  const candidates = candidateBaseUrls({
    env: process.env.EXPO_PUBLIC_API_BASE_URL,
    hostUri: Constants.expoConfig?.hostUri,
    os: Platform.OS,
  });
  const found = await discoverBaseUrl(candidates, probe);
  return found ? { url: found.url, source: found.source } : null;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const fallback = useMemo(() => defaultBaseUrl(), []);
  const [baseUrl, setBaseUrl] = useState(fallback);
  const [source, setSource] = useState<BaseUrlSource>('unreachable');
  const [ready, setReady] = useState(false);

  const runDiscovery = useCallback(async (isActive: () => boolean = () => true) => {
    const found = await discover().catch(() => null);
    if (!isActive()) return;
    setBaseUrl(found?.url ?? fallback);
    setSource(found?.source ?? 'unreachable');
  }, [fallback]);

  useEffect(() => {
    let active = true;
    (async () => {
      let stored = await loadStoredBaseUrl().catch(() => null);
      if (!active) return;
      // A localhost address saved by an older build can never work on a phone.
      if (stored && !__DEV__ && isLoopbackUrl(stored)) {
        await clearStoredBaseUrl().catch(() => undefined);
        stored = null;
      }
      if (stored) {
        setBaseUrl(normalizeBaseUrl(stored));
        setSource('saved');
      } else {
        await runDiscovery(() => active);
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [runDiscovery]);

  const updateBaseUrl = useCallback(async (value: string) => {
    const normalized = normalizeBaseUrl(value);
    setBaseUrl(normalized);
    setSource('saved');
    await storeBaseUrl(normalized);
  }, []);

  const resetBaseUrl = useCallback(async () => {
    await clearStoredBaseUrl();
    await runDiscovery();
  }, [runDiscovery]);

  const rediscover = useCallback(async () => {
    if (source === 'saved') return;
    await runDiscovery();
  }, [runDiscovery, source]);

  const value = useMemo<SettingsContextValue>(
    () => ({ baseUrl, source, ready, defaultBaseUrl: fallback, updateBaseUrl, resetBaseUrl, rediscover }),
    [baseUrl, source, ready, fallback, updateBaseUrl, resetBaseUrl, rediscover]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside a SettingsProvider.');
  }
  return context;
}

/** Re-exported so screens can import storage helpers from one place. */
export { AsyncStorage };
