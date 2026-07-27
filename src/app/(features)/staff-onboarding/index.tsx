import { Redirect, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Dialog, Icon, Portal, Text } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton, AppSnackbar, Screen } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { getAuthStaff, updateStaffPassportPicture } from '@/lib/auth/api';
import { markOnboardingSkipped } from '@/lib/auth/onboarding-skip-store';
import { staffPrerequisiteItems } from '@/lib/auth/prerequisites';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

import { StaffOnboardingChecklist } from '@/features/staff-onboarding/components';

export default function StaffOnboardingScreen() {
  const { session, isSessionLoading } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const queryClient = useQueryClient();
  const [photoDialogVisible, setPhotoDialogVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'danger' | 'success'>('success');
  const [snackbarVisible, setSnackbarVisible] = useState(false);

  const authStaffQuery = useQuery({
    queryKey: ['auth-staff', session?.id],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getAuthStaff(activeSession.accessToken, activeSession.tenantId)
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId),
  });

  const passportPictureMutation = useMutation({
    mutationFn: (file: { uri: string; name: string; type: string }) => {
      if (!session) {
        throw new Error('Session is required to upload passport picture.');
      }

      return authenticatedRequest((activeSession) =>
        updateStaffPassportPicture({
          staffId: activeSession.id,
          file,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      );
    },
    onSuccess: async () => {
      setPhotoDialogVisible(false);
      setMessage('Passport picture updated.');
      setMessageTone('success');
      setSnackbarVisible(true);
      await queryClient.invalidateQueries({ queryKey: ['auth-staff', session?.id] });
      await authStaffQuery.refetch();
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Unable to update passport picture.');
      setMessageTone('danger');
      setSnackbarVisible(true);
    },
  });

  if (isSessionLoading) {
    return (
      <Screen>
        <View style={styles.centerCanvas}>
          <ActivityIndicator color={Colors.light.primary} />
        </View>
      </Screen>
    );
  }

  if (!session) {
    return <Redirect href="/" />;
  }

  const staff = authStaffQuery.data ?? session;
  const completedCount = staff.newStaffPrerequisiteCheck
    ? staffPrerequisiteItems.filter((item) => staff.newStaffPrerequisiteCheck?.[item.key]).length
    : 0;
  const progressPercent = Math.round((completedCount / staffPrerequisiteItems.length) * 100);
  const staffName =
    [staff.firstName, staff.lastName].filter(Boolean).join(' ') || staff.staffIdentificationNumber;

  const handleSkipOnboarding = async () => {
    await markOnboardingSkipped({
      tenantId: session.tenantId,
      staffId: session.id,
    });
    router.replace('/?skipOnboarding=1');
  };

  const handlePickPassportPicture = async (source: 'camera' | 'library') => {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setMessage(
        source === 'camera'
          ? 'Camera permission is required to capture a passport picture.'
          : 'Photo library permission is required to select a passport picture.'
      );
      setMessageTone('danger');
      setSnackbarVisible(true);
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.82,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.82,
          });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    passportPictureMutation.mutate({
      uri: asset.uri,
      name: asset.fileName ?? `passport-picture-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    });
  };

  const appBar = (
    <View style={styles.appBar}>
      <View style={styles.appBarSide} />
      <Text style={styles.appBarTitle}>Onboarding</Text>
      <Pressable
        style={styles.skipTopAction}
        onPress={handleSkipOnboarding}
        hitSlop={8}>
        <Text style={styles.skipTopText}>Skip</Text>
      </Pressable>
    </View>
  );

  return (
    <Screen
      backgroundColor={Colors.light.appBgLight}
      header={appBar}
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      <View style={styles.profilePanel}>
        <View style={styles.profileHero}>
          <ProfileProgressAvatar
            imageUrl={staff.passportPicture}
            initials={getInitials(staffName)}
            progressPercent={progressPercent}
            isUploading={passportPictureMutation.isPending}
            onPress={() => {
              setPhotoDialogVisible(true);
            }}
          />
          <Text style={styles.profileName}>{staffName}</Text>
          <Text style={styles.profileSubtitle}>
            {staff.tenant?.name ?? 'VX HRM'}
          </Text>
        </View>
      </View>

      <StaffOnboardingChecklist checklist={staff.newStaffPrerequisiteCheck} />

      <Portal>
        <Dialog
          visible={photoDialogVisible}
          onDismiss={() => setPhotoDialogVisible(false)}
          style={styles.photoDialog}>
          <Dialog.Title>Add passport picture</Dialog.Title>
          <Dialog.Content style={styles.photoDialogContent}>
            <AppButton
              variant="outline"
              icon="camera-outline"
              loading={passportPictureMutation.isPending}
              disabled={passportPictureMutation.isPending}
              onPress={() => handlePickPassportPicture('camera')}>
              Capture photo
            </AppButton>
            <AppButton
              variant="outline"
              icon="image-outline"
              loading={passportPictureMutation.isPending}
              disabled={passportPictureMutation.isPending}
              onPress={() => handlePickPassportPicture('library')}>
              Choose from gallery
            </AppButton>
          </Dialog.Content>
          <Dialog.Actions>
            <AppButton
              variant="ghost"
              disabled={passportPictureMutation.isPending}
              onPress={() => setPhotoDialogVisible(false)}>
              Cancel
            </AppButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <AppSnackbar
        visible={snackbarVisible}
        message={message}
        tone={messageTone}
        position="top"
        onDismiss={() => setSnackbarVisible(false)}
      />
    </Screen>
  );
}

function ProfileProgressAvatar({
  imageUrl,
  initials,
  progressPercent,
  isUploading,
  onPress,
}: {
  imageUrl?: string;
  initials: string;
  progressPercent: number;
  isUploading: boolean;
  onPress: () => void;
}) {
  const segmentCount = 28;
  const activeSegments = Math.round((progressPercent / 100) * segmentCount);
  const ringSize = 82;
  const ringRadius = 38;
  const segmentWidth = 7;
  const segmentHeight = 3;

  return (
    <Pressable
      disabled={isUploading}
      onPress={onPress}
      style={styles.progressAvatarOuter}>
      {Array.from({ length: segmentCount }, (_, index) => {
        const angle = -90 + (index * 360) / segmentCount;
        const angleRadians = (angle * Math.PI) / 180;

        return (
          <View
            key={index}
            style={[
              styles.progressSegment,
              index < activeSegments ? styles.progressSegmentActive : null,
              {
                left: ringSize / 2 + Math.cos(angleRadians) * ringRadius - segmentWidth / 2,
                top: ringSize / 2 + Math.sin(angleRadians) * ringRadius - segmentHeight / 2,
                transform: [{ rotate: `${angle + 90}deg` }],
              },
            ]}
          />
        );
      })}
      <View style={styles.progressAvatar}>
        {isUploading ? (
          <ActivityIndicator color={Colors.light.primary} />
        ) : imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.progressAvatarImage} />
        ) : (
          <Text style={styles.progressAvatarText}>{initials}</Text>
        )}
      </View>
      {!isUploading && (
        <View style={styles.addPhotoBadge}>
          <Icon source="camera-plus-outline" size={15} color="#ffffff" />
        </View>
      )}
    </Pressable>
  );
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return (words[0] ?? 'U').slice(0, 2).toUpperCase();
}

const styles = StyleSheet.create({
  centerCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.appBgLight,
  },
  appBar: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    backgroundColor: Colors.light.primary,
  },
  appBarSide: {
    width: 78,
    flexDirection: 'row',
    alignItems: 'center',
  },
  appBarTitle: {
    ...Typography.lg,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  skipTopAction: {
    minWidth: 78,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  skipTopText: {
    ...Typography.base,
    color: '#ffffff',
    fontWeight: '600',
  },
  profilePanel: {
    borderRadius: 16,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: '#b9edf6',
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.five,
    marginBottom: Spacing.four,
    shadowColor: '#74d6e8',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 2,
  },
  profileHero: {
    gap: Spacing.one,
    alignItems: 'center',
  },
  progressAvatarOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.surface,
  },
  progressSegment: {
    position: 'absolute',
    width: 7,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.light.warningMuted,
  },
  progressSegmentActive: {
    backgroundColor: '#f5c451',
  },
  progressAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  progressAvatarImage: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
    mixBlendMode: 'multiply',
  },
  progressAvatarText: {
    ...Typography.lg,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  addPhotoBadge: {
    position: 'absolute',
    right: -8,
    bottom: 1,
    minWidth: 38,
    height: 30,
    paddingHorizontal: 8,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primary,
    borderWidth: 3,
    borderColor: Colors.light.surface,
  },
  profileName: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  profileSubtitle: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  photoDialog: {
    borderRadius: 16,
    backgroundColor: '#f7fcfd',
  },
  photoDialogContent: {
    gap: Spacing.two,
  },
});
