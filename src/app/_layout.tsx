import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { paperTheme } from '@/constants/paper-theme';
import { SessionProvider } from '@/lib/auth/session-context';
import { clearAttendanceBiometricSession } from '@/lib/device/attendance-biometric-gate';
import { queryClient } from '@/lib/query-client';
import '@/global.css';

export default function RootLayout() {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        clearAttendanceBiometricSession();
      }
    });

    return () => subscription.remove();
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
