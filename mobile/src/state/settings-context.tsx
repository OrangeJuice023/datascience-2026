import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearStoredBaseUrl, defaultBaseUrl, loadStoredBaseUrl, normalizeBaseUrl, storeBaseUrl } from '@/api/config';

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
  updateBaseUrl: (value: string) => Promise<void>;
  resetBaseUrl: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const fallback = useMemo(() => defaultBaseUrl(), []);
  const [baseUrl, setBaseUrl] = useState(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadStoredBaseUrl()
      .then((stored) => {
        if (!active) return;
        if (stored) setBaseUrl(normalizeBaseUrl(stored));
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
  }, []);

  const updateBaseUrl = useCallback(async (value: string) => {
    const normalized = normalizeBaseUrl(value);
    setBaseUrl(normalized);
    await storeBaseUrl(normalized);
  }, []);

  const resetBaseUrl = useCallback(async () => {
    setBaseUrl(fallback);
    await clearStoredBaseUrl();
  }, [fallback]);

  const value = useMemo<SettingsContextValue>(
    () => ({ baseUrl, ready, defaultBaseUrl: fallback, updateBaseUrl, resetBaseUrl }),
    [baseUrl, ready, fallback, updateBaseUrl, resetBaseUrl]
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
