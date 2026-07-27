import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal, Snackbar } from 'react-native-paper';

import { Colors } from '@/constants/theme';

type AppSnackbarProps = {
  visible: boolean;
  message: string;
  tone?: 'default' | 'danger' | 'success';
  position?: 'bottom' | 'top';
  actionLabel?: string;
  onDismiss: () => void;
  onAction?: () => void;
};

const snackbarColors = {
  default: {
    wrapperStyle: undefined,
    textColor: undefined,
  },
  danger: {
    wrapperStyle: { backgroundColor: Colors.light.danger },
    textColor: '#ffffff',
  },
  success: {
    wrapperStyle: { backgroundColor: Colors.light.success },
    textColor: '#ffffff',
  },
};

export function AppSnackbar({
  visible,
  message,
  tone = 'default',
  position = 'bottom',
  actionLabel = 'Dismiss',
  onDismiss,
  onAction,
}: AppSnackbarProps) {
  const colors = snackbarColors[tone];
  const insets = useSafeAreaInsets();

  return (
    <Portal>
      <Snackbar
        visible={visible}
        onDismiss={onDismiss}
        duration={4000}
        wrapperStyle={position === 'top' ? { top: insets.top + 12, bottom: undefined } : undefined}
        style={colors.wrapperStyle}
        theme={colors.textColor ? { colors: { inverseOnSurface: colors.textColor } } : undefined}
        action={{
          label: actionLabel,
          onPress: onAction ?? onDismiss,
        }}>
        {message}
      </Snackbar>
    </Portal>
  );
}
