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
import { clearLocalFaceVerificationSession } from '@/features/face-verification';
import { queryClient } from '@/lib/query-client';
import '@/global.css';

const FACE_VERIFICATION_BACKGROUND_CLEAR_DELAY_MS = 2500;

export default function RootLayout() {
  const faceVerificationClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const faceVerificationBackgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const cancelScheduledFaceVerificationClear = () => {
      if (!faceVerificationClearTimerRef.current) {
        return;
      }

      clearTimeout(faceVerificationClearTimerRef.current);
      faceVerificationClearTimerRef.current = null;
    };

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background') {
        cancelScheduledFaceVerificationClear();
        faceVerificationBackgroundedAtRef.current = Date.now();
        faceVerificationClearTimerRef.current = setTimeout(() => {
          clearLocalFaceVerificationSession();
          faceVerificationBackgroundedAtRef.current = null;
          faceVerificationClearTimerRef.current = null;
        }, FACE_VERIFICATION_BACKGROUND_CLEAR_DELAY_MS);
        return;
      }

      if (nextState === 'active') {
        const backgroundedAt = faceVerificationBackgroundedAtRef.current;
        cancelScheduledFaceVerificationClear();

        if (
          backgroundedAt &&
          Date.now() - backgroundedAt >= FACE_VERIFICATION_BACKGROUND_CLEAR_DELAY_MS
        ) {
          clearLocalFaceVerificationSession();
        }

        faceVerificationBackgroundedAtRef.current = null;
      }
    });

    return () => {
      cancelScheduledFaceVerificationClear();
      faceVerificationBackgroundedAtRef.current = null;
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
