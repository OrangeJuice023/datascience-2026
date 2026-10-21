import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Sigi } from '@/components/sigi';

/**
 * The splash overlay.
 *
 * The app has no network dependency at start-up, so the splash is brief and
 * purely presentational. It exists to cover the first frame while the
 * router settles, not to pretend something is loading. Sigi is the first
 * thing on screen, and the wordmark is set in the same cream and cobalt as
 * the rest of the app.
 */
export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <View
      onLayout={() => {
        SplashScreen.hideAsync()
          .catch(() => undefined)
          .finally(() => setVisible(false));
      }}
      style={styles.splashOverlay}>
      <Animated.View entering={FadeIn.duration(240)} style={styles.mark}>
        <Sigi state="greeting" size={96} />
        <Text style={styles.wordmark}>SIGMA</Text>
        <Text style={styles.tagline}>Surveillance and access context</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#2468C9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  mark: {
    alignItems: 'center',
    gap: 6,
  },
  wordmark: {
    color: '#FFFCF5',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: 6,
  },
  tagline: {
    color: '#E8E1D5',
    fontSize: 13,
    letterSpacing: 0.4,
  },
});
