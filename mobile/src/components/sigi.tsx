import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';

import type { SigiState } from '@sigma/contracts';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import errorGif from '@/assets/mascot/sigi/error.gif';
import greetingGif from '@/assets/mascot/sigi/greeting.gif';
import idleGif from '@/assets/mascot/sigi/idle.gif';
import insightGif from '@/assets/mascot/sigi/insight.gif';
import listeningGif from '@/assets/mascot/sigi/listening.gif';
import respondingGif from '@/assets/mascot/sigi/responding.gif';
import sleepyGif from '@/assets/mascot/sigi/sleepy.gif';
import successGif from '@/assets/mascot/sigi/success.gif';
import thinkingGif from '@/assets/mascot/sigi/thinking.gif';
import unavailableGif from '@/assets/mascot/sigi/unavailable.gif';
import errorStill from '@/assets/mascot/sigi/frames/error/frame_00.png';
import greetingStill from '@/assets/mascot/sigi/frames/greeting/frame_00.png';
import idleStill from '@/assets/mascot/sigi/frames/idle/frame_00.png';
import insightStill from '@/assets/mascot/sigi/frames/insight/frame_00.png';
import listeningStill from '@/assets/mascot/sigi/frames/listening/frame_00.png';
import respondingStill from '@/assets/mascot/sigi/frames/responding/frame_00.png';
import sleepyStill from '@/assets/mascot/sigi/frames/sleepy/frame_00.png';
import successStill from '@/assets/mascot/sigi/frames/success/frame_00.png';
import thinkingStill from '@/assets/mascot/sigi/frames/thinking/frame_00.png';
import unavailableStill from '@/assets/mascot/sigi/frames/unavailable/frame_00.png';

/**
 * Sigi, the SIGMA companion.
 *
 * The mascot is an interface affordance, not an indicator of what the data
 * means. Its animation says what the app is doing — waiting, listening,
 * working, showing a result — and never whether an outbreak is happening.
 * The data state is always stated in words next to it.
 *
 * The artwork is bundled locally: the animations are cut from the official
 * character sheet (`docs/brand/sigi-mascot-guide.png`) by
 * `web/scripts/generate-sigi-mascot.py` and copied into `mobile/assets`, so
 * the app needs no network to show them. The still for reduced motion is
 * each animation's first frame.
 */

const SOURCES: Record<SigiState, { animated: number; still: number }> = {
  idle: { animated: idleGif, still: idleStill },
  greeting: { animated: greetingGif, still: greetingStill },
  listening: { animated: listeningGif, still: listeningStill },
  thinking: { animated: thinkingGif, still: thinkingStill },
  responding: { animated: respondingGif, still: respondingStill },
  insight: { animated: insightGif, still: insightStill },
  unavailable: { animated: unavailableGif, still: unavailableStill },
  error: { animated: errorGif, still: errorStill },
  success: { animated: successGif, still: successStill },
  sleepy: { animated: sleepyGif, still: sleepyStill },
};

const STATE_PURPOSE: Record<SigiState, string> = {
  idle: 'waiting',
  greeting: 'greeting',
  listening: 'listening',
  thinking: 'working on it',
  responding: 'showing a result',
  insight: 'showing a result',
  unavailable: 'not connected to a source',
  error: 'reporting a failure',
  success: 'reporting a completed action',
  sleepy: 'resting',
};

/** Tracks the operating-system "reduce motion" setting. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduced(enabled);
      })
      .catch(() => undefined);

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduced(enabled);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

export interface SigiProps {
  /** What the app is doing right now. Never a data condition. */
  state?: SigiState;
  /** Rendered size in pixels; the artwork is 160×160. */
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function Sigi({ state = 'idle', size = 64, style }: SigiProps) {
  const reducedMotion = usePrefersReducedMotion();
  const source = reducedMotion ? SOURCES[state].still : SOURCES[state].animated;

  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessible
      accessibilityLabel={`Sigi, the SIGMA companion, ${STATE_PURPOSE[state]}`}
    />
  );
}

/**
 * Picks the mascot state for a data status.
 *
 * The mapping is deliberately conservative: a source that is not connected
 * gets the puzzled pose, a failed request gets the concerned pose, and only a
 * result that actually came back gets the "insight" pose. Nothing here ever
 * claims that a condition was detected.
 */
export { sigiStateForData } from './sigi-state';

/**
 * Sigi next to a sentence.
 *
 * The sentence carries the meaning; the mascot only shows what the app is
 * doing. A note without a sentence is never rendered, so the animation can
 * never be the only thing a reader sees.
 */
export function SigiNote({
  state,
  size = 56,
  children,
}: {
  state: SigiState;
  size?: number;
  children: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.note, { backgroundColor: theme.brandWash }]}>
      <Sigi state={state} size={size} />
      <Text style={[styles.noteText, { color: theme.textSecondaryStrong }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
