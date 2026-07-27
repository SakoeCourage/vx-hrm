/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    primary: '#087d96',
    primaryMuted: '#e4f6fa',
    secondary: '#45616a',
    secondaryMuted: '#edf5f7',
    success: '#087443',
    successMuted: '#e6f6ec',
    warning: '#b54708',
    warningMuted: '#fff4df',
    danger: '#d92d20',
    dangerMuted: '#fee4e2',
    info: '#087d96',
    infoMuted: '#e4f6fa',
    text: '#123943',
    background: '#ffffff',
    appBackground: '#f7f9fb',
    appBgLight: '#e4f3f7',
    surface: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    border: '#e6eaee',
    textSecondary: '#45616a',
  },
  dark: {
    primary: '#087d96',
    primaryMuted: '#123d47',
    secondary: '#b0b4ba',
    secondaryMuted: '#2e3135',
    success: '#32d583',
    successMuted: '#063f2a',
    warning: '#fdb022',
    warningMuted: '#4a2b08',
    danger: '#f97066',
    dangerMuted: '#55160c',
    info: '#4db8cc',
    infoMuted: '#123d47',
    text: '#ffffff',
    background: '#101418',
    appBackground: '#101418',
    appBgLight: '#101418',
    surface: '#111315',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    border: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
  eight: 64,
} as const;

export const Typography = {
  xs: { fontSize: 11, lineHeight: 16 },
  sm: { fontSize: 12, lineHeight: 18 },
  base: { fontSize: 14, lineHeight: 20 },
  md: { fontSize: 16, lineHeight: 24 },
  lg: { fontSize: 20, lineHeight: 28 },
  xl: { fontSize: 24, lineHeight: 32 },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
