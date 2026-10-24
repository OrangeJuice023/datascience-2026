/**
 * Colors, spacing, type scale.
 *
 * The same system as the web app (web/src/app/globals.css), built from the Sigi
 * character sheet (docs/brand/sigi-mascot-guide.png):
 *
 *   Frame          #F2F1ED   the page behind cards (a low-chroma step of Sigi's sand cream)
 *   Sheet          #FFFFFF   cards and sheets, where data is read
 *   Ink            #22231F   text and the one filled button
 *   Muted text     #5F5D56   secondary text (6:1 on white, 5.4:1 on the frame)
 *   Cobalt         #2468C9   actions, links, the accent, and data from a connected source
 *   Amber          #D88A0B   demo data (labels in #8A4B08)
 *   Neutral grey   #8A877E   capabilities that are not connected
 *   Red            #C4242A   unavailable and errors
 *   Leaf green     #747D59   the brand mark and Sigi's world
 *   Forest         #1E4D36   dashboard headings, chart lines and the wordmark
 *                            (Overview / Explore redesign, 2026-10-24)
 *
 * Signal classes (EARS C1/C2/C3 and alarm-week bins) use one ordinal ramp,
 * checked with the dataviz palette validator (CVD and normal-vision
 * separation pass; the gold is below 3:1, so it is always shown with a
 * labelled legend):  none #2F9A5A, C1 #D4A20A, C2 #E2532B, C3 #8E1F5C;
 * dark mode has its own steps, validated on #121211: #24834C, #B78D11, #C8363F, #B66BD0.
 *
 * The semantic colors are the important part: `live`, `demo`, `not_connected`
 * and `unavailable` must never look alike, because a demo series and a live
 * series must never look alike either. They match the web app's evidence
 * colours: formal data cobalt, demo amber, not connected grey.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    /** The page behind everything. */
    background: '#F2F1ED',
    /** Cards and sheets. */
    backgroundElement: '#FFFFFF',
    /** Selected rows and tinted fills. */
    backgroundSelected: '#E8E6E0',
    /** Body text. */
    text: '#22231F',
    /** Secondary text, on a card. */
    textSecondary: '#5F5D56',
    /** Secondary text straight on the frame, and small sizes. */
    textSecondaryStrong: '#4A4943',
    /** Hairlines and card borders. */
    border: '#E1DED7',
    /** Actions, links, the accent. */
    accent: '#2468C9',
    /** Tinted accent fills. */
    accentSoft: '#EEF4FC',
    /** Sigi's sand cream, for the band Sigi sits on. */
    brandWash: '#F4F0E6',
    /** Data from a connected source. */
    live: '#2468C9',
    /** Simulated data. */
    demo: '#D88A0B',
    /** A capability that is not wired to a source. */
    notConnected: '#8A877E',
    /** A capability that has no data right now. */
    unavailable: '#C4242A',
    /**
     * Darker steps of the same hues, for when the colour carries text. The
     * status hues above are fills and dots; a label set in the fill colour
     * would sit below the 4.5:1 contrast a small label needs.
     */
    liveText: '#1D55A6',
    demoText: '#8A4B08',
    notConnectedText: '#5F5D56',
    unavailableText: '#A11D22',
    /** Dashboard headings, chart lines, the wordmark. */
    brand: '#1E4D36',
    /** Tinted stat tiles. */
    brandSoft: '#E6EDE3',
    /** The tile that marks a peak. */
    alertSoft: '#F8E3DF',
    /** The faint grid behind the dashboards and chart gridlines. */
    grid: '#E5E3DB',
    /** Signal classes, lowest to highest. */
    signalNone: '#2F9A5A',
    signalC1: '#D4A20A',
    signalC2: '#E2532B',
    signalC3: '#8E1F5C',
    /** No computable result: drawn hollow, never as the lowest class. */
    noResult: '#9C998F',
    /** Land on the maps: neutral, never a data value. */
    land: '#D3E0CF',
  },
  dark: {
    background: '#121211',
    backgroundElement: '#1C1C1A',
    backgroundSelected: '#2A2A27',
    text: '#F4F3EF',
    textSecondary: '#B4B2AA',
    textSecondaryStrong: '#C8C6BE',
    border: '#2E2E2B',
    accent: '#7FB0F0',
    accentSoft: '#1C2735',
    brandWash: '#22221E',
    live: '#7FB0F0',
    demo: '#F0B44C',
    notConnected: '#9A978E',
    unavailable: '#EF6F6C',
    liveText: '#9CC2F4',
    demoText: '#F5C46E',
    notConnectedText: '#B4B2AA',
    unavailableText: '#F28B88',
    brand: '#9FD3B4',
    brandSoft: '#1E2A22',
    alertSoft: '#3A2523',
    grid: '#262622',
    signalNone: '#24834C',
    signalC1: '#B78D11',
    signalC2: '#C8363F',
    signalC3: '#B66BD0',
    noResult: '#77746C',
    land: '#2E3A31',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * The status token that carries text, for each data status.
 *
 * `live`, `demo` and `not_connected` are the fill colours; the `…Text`
 * tokens are the darker steps of the same hues, used whenever the colour is
 * the colour of words rather than of a dot or a rule.
 */
export const STATUS_TEXT_TOKEN: Record<string, ThemeColor> = {
  live: 'liveText',
  demo: 'demoText',
  not_connected: 'notConnectedText',
  unavailable: 'unavailableText',
};

/** The same mapping for the flat tone names used by `FactRow`. */
export const TONE_TEXT_TOKEN: Partial<Record<ThemeColor, ThemeColor>> = {
  live: 'liveText',
  demo: 'demoText',
  notConnected: 'notConnectedText',
  unavailable: 'unavailableText',
};

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** Pixelify Sans (OFL), the web app's pixel face, loaded in app/_layout.tsx. */
export const PixelFont = {
  regular: 'PixelifySans_400Regular',
  bold: 'PixelifySans_700Bold',
} as const;

/**
 * The type scale.
 *
 * One sans face, as on the web app: screen titles at 24/700, section titles
 * at 17/600, body at 15 and labels at 13. Numbers are tabular so that a column of
 * figures lines up and a changing digit does not shift the ones next to it.
 */
export const Type = {
  display: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600' as const,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    lineHeight: 21,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  /** Figures: aligned columns, no reflow when a digit changes. */
  numeric: {
    fontVariant: ['tabular-nums' as const],
  },
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/** Colors for the data-status pill, keyed by `DataStatus`. */
export const STATUS_COLOR: Record<string, ThemeColor> = {
  live: 'live',
  demo: 'demo',
  not_connected: 'notConnected',
  unavailable: 'unavailable',
};

export const STATUS_LABEL: Record<string, string> = {
  live: 'Live',
  demo: 'Demo data',
  not_connected: 'Not connected',
  unavailable: 'Unavailable',
};
