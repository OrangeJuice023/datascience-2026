import { PixelifySans_400Regular, PixelifySans_700Bold, useFonts } from '@expo-google-fonts/pixelify-sans';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import type { ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { LoadingState } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { SettingsProvider, useSettings } from '@/state/settings-context';
import { UnitsProvider } from '@/state/units-context';

SplashScreen.preventAutoHideAsync();

/**
 * Holds the screens back until the API address is known, so none of them
 * fetches from a guess, and until the pixel font has loaded (or failed, in
 * which case the system font is used).
 */
function ApiGate({ children }: { children: ReactNode }) {
  const { ready } = useSettings();
  const [fontsLoaded, fontError] = useFonts({ PixelifySans_400Regular, PixelifySans_700Bold });
  const theme = useTheme();
  if (ready && (fontsLoaded || fontError)) return <>{children}</>;
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.background }}>
      <LoadingState label="Finding the SIGMA API…" />
    </View>
  );
}

/**
 * The root: the three tabs (Overview, Explore, Analyze) in `(tabs)`, and
 * Settings and About opened on top of them from each tab's header.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SettingsProvider>
        <AnimatedSplashOverlay />
        <ApiGate>
          <UnitsProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
              <Stack.Screen name="about" options={{ presentation: 'modal' }} />
            </Stack>
          </UnitsProvider>
        </ApiGate>
      </SettingsProvider>
    </ThemeProvider>
    </GestureHandlerRootView>
  );
}
