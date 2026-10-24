import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { fetchHealth } from '@/api/endpoints';
import { chooseBaseUrl, clearStoredBaseUrl, defaultBaseUrl, loadStoredBaseUrl, normalizeBaseUrl, storeBaseUrl } from '@/api/config';

/** A short health check: a startup probe must not hold the app for the full request timeout. */
const PROBE_TIMEOUT_MS = 6_000;

async function answers(baseUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetchHealth(baseUrl, controller.signal);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The API address the app talks to.
 *
 * The value is shared by every screen, so changing it in Settings changes
 * the whole app at once. It is also shown on the Overview screen, because
 * an app that silently points somewhere else is impossible to trust.
 */

interface SettingsContextValue {
  baseUrl: string;
  /** False until the stored value has been read. */
  ready: boolean;
  /** The value the app would use with no stored override. */
  defaultBaseUrl: string;
  /** A saved address the app passed over at startup because it could not be used. */
  skippedBaseUrl: string | null;
  updateBaseUrl: (value: string) => Promise<void>;
  resetBaseUrl: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const fallback = useMemo(() => defaultBaseUrl(), []);
  const [baseUrl, setBaseUrl] = useState(fallback);
  const [ready, setReady] = useState(false);
  const [skippedBaseUrl, setSkippedBaseUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadStoredBaseUrl()
      .then((stored) => chooseBaseUrl(stored, fallback, answers))
      .then(async (choice) => {
        if (!active) return;
        setBaseUrl(choice.baseUrl);
        setSkippedBaseUrl(choice.skipped);
        if (choice.clearStored) await clearStoredBaseUrl();
      })
      .catch(() => {
        // A storage failure is not fatal: the default still works.
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [fallback]);

  const updateBaseUrl = useCallback(async (value: string) => {
    const normalized = normalizeBaseUrl(value);
    setBaseUrl(normalized);
    setSkippedBaseUrl(null);
    await storeBaseUrl(normalized);
  }, []);

  const resetBaseUrl = useCallback(async () => {
    setBaseUrl(fallback);
    setSkippedBaseUrl(null);
    await clearStoredBaseUrl();
  }, [fallback]);

  const value = useMemo<SettingsContextValue>(
    () => ({ baseUrl, ready, defaultBaseUrl: fallback, skippedBaseUrl, updateBaseUrl, resetBaseUrl }),
    [baseUrl, ready, fallback, skippedBaseUrl, updateBaseUrl, resetBaseUrl]
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
