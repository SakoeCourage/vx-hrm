import { StatusBar, type StatusBarStyle } from 'expo-status-bar';
import { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  backgroundColor?: string;
  bounces?: boolean;
  contentStyle?: ViewStyle;
  header?: React.ReactNode;
  onScroll?: React.ComponentProps<typeof Animated.ScrollView>['onScroll'];
  scrollEventThrottle?: number;
  statusBarBackgroundColor?: string;
  statusBarStyle?: StatusBarStyle;
}>;

export function Screen({
  children,
  backgroundColor,
  bounces,
  contentStyle,
  header,
  onScroll,
  scrollEventThrottle,
  statusBarBackgroundColor,
  statusBarStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.safeArea, backgroundColor ? { backgroundColor } : null]}>
      {statusBarBackgroundColor && (
        <StatusBar style={statusBarStyle ?? 'auto'} backgroundColor={statusBarBackgroundColor} />
      )}
      {statusBarBackgroundColor && (
        <View
          style={[
            styles.statusBarBackground,
            { height: insets.top, backgroundColor: statusBarBackgroundColor },
          ]}
        />
      )}
      {header}
      <Animated.ScrollView
        style={[styles.scroll, backgroundColor ? { backgroundColor } : null]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={bounces}
        alwaysBounceVertical={bounces}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.light.appBackground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.six,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  statusBarBackground: {
    marginTop: 0,
  },
});
