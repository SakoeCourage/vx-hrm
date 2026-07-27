import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, PropsWithChildren, useCallback, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';

import { Colors, Spacing, Typography } from '@/constants/theme';

type AppBottomSheetProps = PropsWithChildren<{
  snapPoints?: (string | number)[];
  title?: string;
  subtitle?: string;
  contentStyle?: ViewStyle;
  onDismiss?: () => void;
  scrollable?: boolean;
}>;

export const AppBottomSheet = forwardRef<BottomSheetModal, AppBottomSheetProps>(
  (
    {
      children,
      snapPoints,
      title,
      subtitle,
      contentStyle,
      onDismiss,
      scrollable,
    },
    ref
  ) => {
    const sheetSnapPoints = useMemo(() => snapPoints ?? ['35%', '70%'], [snapPoints]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.35}
        />
      ),
      []
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={sheetSnapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
        onDismiss={onDismiss}>
        {scrollable ? (
          <BottomSheetScrollView contentContainerStyle={[styles.content, contentStyle]}>
            {(title || subtitle) && (
              <View style={styles.header}>
                {title && <Text style={styles.title}>{title}</Text>}
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
            )}
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={[styles.content, contentStyle]}>
            {(title || subtitle) && (
              <View style={styles.header}>
                {title && <Text style={styles.title}>{title}</Text>}
                {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
              </View>
            )}
            {children}
          </BottomSheetView>
        )}
      </BottomSheetModal>
    );
  }
);

AppBottomSheet.displayName = 'AppBottomSheet';

const styles = StyleSheet.create({
  background: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: Colors.light.surface,
  },
  handle: {
    width: 42,
    backgroundColor: '#b8dce4',
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
    paddingBottom: Spacing.one,
  },
  title: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '600',
  },
  subtitle: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
});
