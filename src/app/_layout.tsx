import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { paperTheme } from '@/constants/paper-theme';
import { SessionProvider } from '@/lib/auth/session-context';
import { clearAttendanceBiometricSession } from '@/lib/device/attendance-biometric-gate';
import { queryClient } from '@/lib/query-client';
import '@/global.css';

const BIOMETRIC_BACKGROUND_CLEAR_DELAY_MS = 2500;

export default function RootLayout() {
  const biometricClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const biometricBackgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const cancelScheduledBiometricClear = () => {
      if (!biometricClearTimerRef.current) {
        return;
      }

      clearTimeout(biometricClearTimerRef.current);
      biometricClearTimerRef.current = null;
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        cancelScheduledBiometricClear();
        biometricBackgroundedAtRef.current = Date.now();
        biometricClearTimerRef.current = setTimeout(() => {
          clearAttendanceBiometricSession();
          biometricBackgroundedAtRef.current = null;
          biometricClearTimerRef.current = null;
        }, BIOMETRIC_BACKGROUND_CLEAR_DELAY_MS);
        return;
      }

      if (nextState === 'active') {
        const backgroundedAt = biometricBackgroundedAtRef.current;
        cancelScheduledBiometricClear();

        if (
          backgroundedAt &&
          Date.now() - backgroundedAt >= BIOMETRIC_BACKGROUND_CLEAR_DELAY_MS
        ) {
          clearAttendanceBiometricSession();
        }

        biometricBackgroundedAtRef.current = null;
      }
    });

    return () => {
      cancelScheduledBiometricClear();
      biometricBackgroundedAtRef.current = null;
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <PaperProvider theme={paperTheme}>
              <BottomSheetModalProvider>
                <Stack screenOptions={{ headerShown: false }} />
              </BottomSheetModalProvider>
            </PaperProvider>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
