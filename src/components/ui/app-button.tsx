import { StyleSheet, type ViewStyle } from 'react-native';
import { Button, type ButtonProps } from 'react-native-paper';

import { Colors } from '@/constants/theme';

type AppButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'outline' | 'ghost';

type AppButtonProps = Omit<ButtonProps, 'mode'> & {
  variant?: AppButtonVariant;
  style?: ViewStyle;
};

const buttonVariants: Record<
  AppButtonVariant,
  {
    mode: ButtonProps['mode'];
    buttonColor?: string;
    textColor?: string;
    borderColor?: string;
  }
> = {
  primary: {
    mode: 'contained',
    buttonColor: Colors.light.primary,
    textColor: '#ffffff',
  },
  secondary: {
    mode: 'contained',
    buttonColor: Colors.light.secondaryMuted,
    textColor: Colors.light.secondary,
  },
  success: {
    mode: 'contained',
    buttonColor: Colors.light.success,
    textColor: '#ffffff',
  },
  warning: {
    mode: 'contained',
    buttonColor: Colors.light.warning,
    textColor: '#ffffff',
  },
  danger: {
    mode: 'contained',
    buttonColor: Colors.light.danger,
    textColor: '#ffffff',
  },
  outline: {
    mode: 'outlined',
    textColor: Colors.light.primary,
    borderColor: Colors.light.primary,
  },
  ghost: {
    mode: 'text',
    textColor: Colors.light.primary,
  },
};

export function AppButton({ variant = 'primary', style, labelStyle, ...props }: AppButtonProps) {
  const config = buttonVariants[variant];

  return (
    <Button
      mode={config.mode}
      buttonColor={config.buttonColor}
      textColor={config.textColor}
      contentStyle={styles.content}
      style={[styles.button, config.borderColor ? { borderColor: config.borderColor } : null, style]}
      labelStyle={[styles.label, labelStyle]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
  },
  content: {
    minHeight: 48,
    paddingHorizontal: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
});
