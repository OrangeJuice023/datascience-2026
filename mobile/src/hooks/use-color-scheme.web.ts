import { useSyncExternalStore } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Web colour scheme.
 *
 * The web build renders on the server, where the real scheme is unknown.
 * `useSyncExternalStore` gives React the server snapshot during
 * hydration and the client snapshot afterwards, without a cascading
 * `setState` inside an effect.
 */
const subscribe = () => () => undefined;

export function useColorScheme() {
  const colorScheme = useRNColorScheme();

  return useSyncExternalStore(
    subscribe,
    () => colorScheme,
    () => 'light'
  );
}
