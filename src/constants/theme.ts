import '@/global.css';

import { Platform } from 'react-native';

/**
 * Fitty — Apple Health–style design language.
 * Monochrome surfaces and text; color is reserved for the activity
 * rings (and functional error red). System font throughout.
 */

/** Activity ring colors — the only color in the app */
export const RingColors = {
  steps: '#007AFF',
  calories: '#FF3B30',
  minutes: '#34C759',
} as const;

/** Functional error red */
export const ErrorRed = '#FF3B30';

/** Ring goal defaults */
export const RingGoals = {
  steps: 10_000,
  calories: 500,
  minutes: 30,
} as const;

export const Colors = {
  light: {
    text: '#000000',
    background: '#F2F2F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E4E4E9',
    card: '#FFFFFF',
    textSecondary: '#6E6E73',
    separator: '#E5E5EA',
    rule: '#000000',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2C2E',
    card: '#1C1C1E',
    textSecondary: '#98989E',
    separator: '#38383A',
    rule: '#FFFFFF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-sans)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-sans)',
    mono: 'var(--font-mono)',
  },
});

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
export const MaxContentWidth = 540;

/** Uniform height for all dashboard cards (sleep, metrics, skeletons) */
export const MetricCardMinHeight = 112;
