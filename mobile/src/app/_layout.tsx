import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { SettingsProvider } from '@/state/settings-context';
import { UnitsProvider } from '@/state/units-context';

SplashScreen.preventAutoHideAsync();

/**
 * The root: the three tabs (Overview, Explore, Analyze) in `(tabs)`, and
 * Settings opened on top of them from the gear in each tab's header.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SettingsProvider>
        <UnitsProvider>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          </Stack>
        </UnitsProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
