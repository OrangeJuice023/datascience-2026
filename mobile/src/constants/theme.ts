/**
 * Colors, spacing, type scale.
 *
 * The palette is the SIGMA field-guide system: warm paper, ink, and a small
 * set of accents that carry meaning rather than decoration.
 *
 *   Paper          #F4F0E6   the page
 *   Warm surface   #FFFCF5   cards and sheets
 *   Primary ink    #22231F   text
 *   Muted text     #6F706B   secondary text
 *   SIGMA cobalt   #2468C9   actions and the accent
 *   Olive          #747D59   live data
 *   Terracotta     #B66D4D   demo data
 *   Slate blue     #627B8B   data that is not connected
 *   Fine borders   #DAD3C6   hairlines
 *   Muted wash     #E8E1D5   selected and tinted fills
 *
 * The semantic colors are the important part: `live`, `demo`, `not_connected`
 * and `unavailable` must never look alike, because a demo series and a live
 * series must never look alike either.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    /** The page behind everything. */
    background: '#F4F0E6',
    /** Cards and sheets. */
    backgroundElement: '#FFFCF5',
    /** Selected rows and tinted fills. */
    backgroundSelected: '#E8E1D5',
    /** Body text. */
    text: '#22231F',
    /** Secondary text, on a card. */
    textSecondary: '#6F706B',
    /**
     * Secondary text straight on the paper background. The muted token is
     * 4.4:1 on paper and 4.9:1 on a card, so this slightly darker step is
     * used where the smaller sizes sit directly on the page.
     */
    textSecondaryStrong: '#5F605B',
    /** Hairlines and card borders. */
    border: '#DAD3C6',
    /** Actions, links, the accent. */
    accent: '#2468C9',
    /** Tinted accent fills. */
    accentSoft: '#E8E1D5',
    /** Data from a connected source. */
    live: '#747D59',
    /** Simulated data. */
    demo: '#B66D4D',
    /** A capability that is not wired to a source. */
    notConnected: '#627B8B',
    /** A capability that has no data right now. */
    unavailable: '#8A3A28',
    /**
     * Darker steps of the same hues, for when the colour carries text. The
     * status hues above are fills and dots; a label set in the fill colour
     * would sit below the 4.5:1 contrast a small label needs.
     */
    liveText: '#5F6743',
    demoText: '#8F4A2E',
    notConnectedText: '#4E6373',
    unavailableText: '#8A3A28',
  },
  dark: {
    background: '#1A1B14',
    backgroundElement: '#23241B',
    backgroundSelected: '#2F3026',
    text: '#F1EDE2',
    textSecondary: '#A9A79C',
    textSecondaryStrong: '#BFBDAF',
    border: '#3A3B30',
    accent: '#7FB0F0',
    accentSoft: '#22303F',
    live: '#A8B487',
    demo: '#D79A7C',
    notConnected: '#9DB4C2',
    unavailable: '#E08A70',
    liveText: '#C3CDA0',
    demoText: '#E8A88A',
    notConnectedText: '#B9CBD8',
    unavailableText: '#F0A48C',
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

/**
 * The type scale.
 *
 * Headings are set in the display serif, which is what gives the app its
 * field-guide character; body copy stays in the system sans for legibility at
 * small sizes. Numbers are tabular so that a column of figures lines up and a
 * changing digit does not shift the ones next to it.
 */
export const Type = {
  display: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '700' as const,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
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
