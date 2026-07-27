import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { Colors } from '@/constants/theme';

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 2,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.light.primary,
    onPrimary: '#ffffff',
    primaryContainer: Colors.light.primaryMuted,
    onPrimaryContainer: Colors.light.primary,
    secondary: Colors.light.primary,
    onSecondary: '#ffffff',
    secondaryContainer: Colors.light.primaryMuted,
    onSecondaryContainer: Colors.light.primary,
    tertiary: Colors.light.primary,
    tertiaryContainer: Colors.light.primaryMuted,
    background: Colors.light.background,
    onBackground: Colors.light.text,
    surface: Colors.light.surface,
    onSurface: Colors.light.text,
    surfaceDisabled: '#eef1f4',
    onSurfaceDisabled: '#98a2b3',
    surfaceVariant: Colors.light.backgroundElement,
    onSurfaceVariant: 'rgba(96, 100, 108, 0.55)',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level1: '#f7fcfd',
      level2: '#f2fafc',
      level3: Colors.light.primaryMuted,
      level4: Colors.light.primaryMuted,
      level5: Colors.light.primaryMuted,
    },
    outline: Colors.light.border,
    error: Colors.light.danger,
  },
};
