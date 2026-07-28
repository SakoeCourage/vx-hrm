import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Switch, Text } from 'react-native-paper';

import { AppButton, Screen } from '@/components/ui';
import { BottomTabInset, Colors, Spacing, Typography } from '@/constants/theme';
import {
  clearLocalFaceEnrollment,
  clearLocalFaceVerificationSession,
  getLocalFaceEnrollment,
  getLocalFaceStaffIdentity,
} from '@/features/face-verification';
import { useSession } from '@/lib/auth/session-context';

const settings = [
  {
    icon: 'bell-ring-outline',
    title: 'Push notifications',
    description: 'Receive HR updates, approvals, and attendance reminders.',
    value: true,
  },
  {
    icon: 'email-outline',
    title: 'Email notifications',
    description: 'Send important HR activity to your registered email.',
    value: true,
  },
  {
    icon: 'fingerprint',
    title: 'Biometric unlock',
    description: 'Use Face ID, Touch ID, or device biometrics to unlock the app.',
    value: false,
  },
  {
    icon: 'map-marker-check-outline',
    title: 'Location reminders',
    description: 'Remind you to clock in or out when you are near a duty point.',
    value: false,
  },
  {
    icon: 'theme-light-dark',
    title: 'Dark mode',
    description: 'Use a darker app appearance when it becomes available.',
    value: false,
  },
] as const;

export default function AccountSettingsScreen() {
  const { session } = useSession();
  const [hasFaceEnrollment, setHasFaceEnrollment] = useState(false);
  const [isCheckingFaceEnrollment, setIsCheckingFaceEnrollment] = useState(true);
  const [isDeletingFaceEnrollment, setIsDeletingFaceEnrollment] = useState(false);
  const staffIdentity = getLocalFaceStaffIdentity({
    staffIdentificationNumber: session?.staffIdentificationNumber,
    tenantId: session?.tenantId,
  });

  useEffect(() => {
    let isMounted = true;

    if (!staffIdentity) {
      setHasFaceEnrollment(false);
      setIsCheckingFaceEnrollment(false);
      return;
    }

    setIsCheckingFaceEnrollment(true);
    getLocalFaceEnrollment(staffIdentity)
      .then((enrollment) => {
        if (isMounted) {
          setHasFaceEnrollment(Boolean(enrollment));
        }
      })
      .catch(() => {
        if (isMounted) {
          setHasFaceEnrollment(false);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsCheckingFaceEnrollment(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [staffIdentity]);

  const deleteFaceEnrollment = async () => {
    if (!staffIdentity) {
      return;
    }

    setIsDeletingFaceEnrollment(true);

    try {
      await clearLocalFaceEnrollment(staffIdentity);
      clearLocalFaceVerificationSession();
      setHasFaceEnrollment(false);
    } finally {
      setIsDeletingFaceEnrollment(false);
    }
  };

  const handleDeleteFaceEnrollment = () => {
    if (!hasFaceEnrollment || isCheckingFaceEnrollment || isDeletingFaceEnrollment) {
      return;
    }

    Alert.alert(
      'Delete enrolled face?',
      'You will need to enroll your face again before scanning attendance QR codes.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteFaceEnrollment();
          },
        },
      ]
    );
  };

  const handleFaceEnrollmentAction = () => {
    if (hasFaceEnrollment) {
      handleDeleteFaceEnrollment();
      return;
    }

    router.push('/face-enrollment');
  };

  return (
    <Screen
      backgroundColor={Colors.light.appBgLight}
      contentStyle={styles.content}
      header={
        <View style={styles.appBar}>
          <Pressable style={styles.appBarButton} onPress={() => router.back()}>
            <Icon source="chevron-left" size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.appBarTitle}>Account settings</Text>
          <View style={styles.appBarSpacer} />
        </View>
      }
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      <View style={styles.introCard}>
        <View style={styles.introIcon}>
          <Icon source="account-cog-outline" size={26} color={Colors.light.primary} />
        </View>
        <View style={styles.introText}>
          <Text style={styles.introTitle}>Preferences</Text>
          <Text style={styles.introDescription}>Manage notifications, appearance, and local security settings for this device.</Text>
        </View>
      </View>

      <View style={styles.settingsCard}>
        {settings.map((setting, index) => (
          <View key={setting.title} style={[styles.settingRow, index > 0 && styles.settingRowBorder]}>
            <View style={styles.settingIcon}>
              <Icon source={setting.icon} size={20} color={Colors.light.primary} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingTitle}>{setting.title}</Text>
              <Text style={styles.settingDescription}>{setting.description}</Text>
            </View>
            <Switch
              value={setting.value}
              disabled
              color={Colors.light.primary}
            />
          </View>
        ))}
      </View>

      <View style={styles.securityCard}>
        <View style={styles.securityHeader}>
          <View style={styles.securityIcon}>
            <Icon source="face-recognition" size={20} color={Colors.light.primary} />
          </View>
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Face enrollment</Text>
            <Text style={styles.settingDescription}>
              {hasFaceEnrollment
                ? 'A face enrollment is saved on this device.'
                : 'No face enrollment is saved on this device.'}
            </Text>
          </View>
        </View>
        <AppButton
          variant={hasFaceEnrollment ? 'danger' : 'outline'}
          icon={hasFaceEnrollment ? 'trash-can-outline' : undefined}
          loading={isDeletingFaceEnrollment}
          disabled={isCheckingFaceEnrollment || isDeletingFaceEnrollment}
          onPress={handleFaceEnrollmentAction}>
          {hasFaceEnrollment ? 'Delete enrolled face' : 'Enroll new face'}
        </AppButton>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  appBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Colors.light.primary,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  appBarButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  appBarTitle: {
    ...Typography.md,
    flex: 1,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  appBarSpacer: {
    width: 38,
    height: 38,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.four,
  },
  introIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  introText: {
    flex: 1,
    minWidth: 0,
  },
  introTitle: {
    ...Typography.md,
    color: Colors.light.text,
    fontWeight: '600',
  },
  introDescription: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    marginTop: Spacing.one,
  },
  settingsCard: {
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  securityCard: {
    gap: Spacing.three,
    borderRadius: 22,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    padding: Spacing.four,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  securityIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  settingRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  settingRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  settingText: {
    flex: 1,
    minWidth: 0,
  },
  settingTitle: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
  },
  settingDescription: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
});
