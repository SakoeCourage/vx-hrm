import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

import { Screen } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getAuthStaff } from '@/lib/auth/api';
import { hasActiveOnboardingSkip } from '@/lib/auth/onboarding-skip-store';
import { getMissingPrerequisites } from '@/lib/auth/prerequisites';
import { useSession } from '@/lib/auth/session-context';
import { StaffSession } from '@/lib/auth/types';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';
import { useQuery } from '@tanstack/react-query';

import { LoginView } from '@/features/auth/components/login-view';

type AuthStep = 'login' | 'onboarding' | 'home';

export function AuthFlowScreen() {
  const { session, isSessionLoading, setSession } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const { skipOnboarding } = useLocalSearchParams<{ skipOnboarding?: string }>();
  const [step, setStep] = useState<AuthStep>('login');

  const authStaffQuery = useQuery({
    queryKey: ['auth-staff', session?.id],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getAuthStaff(activeSession.accessToken, activeSession.tenantId)
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId),
  });

  const onboardingSkipQuery = useQuery({
    queryKey: ['onboarding-skip', session?.tenantId, session?.id],
    queryFn: () =>
      hasActiveOnboardingSkip({
        tenantId: session?.tenantId,
        staffId: session?.id,
      }),
    enabled: Boolean(session?.tenantId && session?.id),
  });

  const handleAuthenticated = async (staffSession: StaffSession) => {
    const skippedOnboarding = await hasActiveOnboardingSkip({
      tenantId: staffSession.tenantId,
      staffId: staffSession.id,
    });

    await setSession(staffSession);
    setStep(hasMissingPrerequisites(staffSession) && !skippedOnboarding ? 'onboarding' : 'home');
  };

  if (isSessionLoading) {
    return (
      <Screen>
        <View style={styles.centerCanvas}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.mutedText}>Preparing secure session</Text>
        </View>
      </Screen>
    );
  }

  const staff = authStaffQuery.data ?? session;
  const missingPrerequisites = getMissingPrerequisites(staff?.newStaffPrerequisiteCheck);
  const hasSkippedOnboarding = skipOnboarding === '1' || onboardingSkipQuery.data === true;
  const isCheckingOnboardingSkip =
    Boolean(session && missingPrerequisites.length > 0) && onboardingSkipQuery.isLoading;
  const showOnboarding =
    step === 'onboarding' ||
    Boolean(
      session &&
        step !== 'home' &&
        !hasSkippedOnboarding &&
        missingPrerequisites.length > 0
    );

  if (isCheckingOnboardingSkip) {
    return (
      <Screen>
        <View style={styles.centerCanvas}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.mutedText}>Checking onboarding status</Text>
        </View>
      </Screen>
    );
  }

  if (session && showOnboarding) {
    return <Redirect href="/staff-onboarding" />;
  }

  if (session && !showOnboarding) {
    return <Redirect href="/home" />;
  }

  return <LoginView onAuthenticated={handleAuthenticated} />;
}

function hasMissingPrerequisites(session: StaffSession) {
  return getMissingPrerequisites(session.newStaffPrerequisiteCheck).length > 0;
}

const styles = StyleSheet.create({
  centerCanvas: {
    flex: 1,
    minHeight: 560,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  mutedText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
});
