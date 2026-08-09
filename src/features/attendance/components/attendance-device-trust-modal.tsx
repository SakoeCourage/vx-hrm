import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppButton } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { MobileAttendanceDeviceTrustStatus } from '@/lib/auth/api';
import {
  AttendancePermissionState,
  canUseAttendancePermissions,
  needsAttendancePermissionSettings,
} from '@/lib/device/attendance-permissions';

const trustDeviceImage = require('@/assets/images/trust-device.png');
const transferDeviceImage = require('@/assets/images/transfer-device.png');
const deviceUsedByStaffImage = require('@/assets/images/device-used-by-staff.png');
const attendancePermissionsImage = require('@/assets/images/attendance-permissions.png');

type AttendanceDeviceTrustModalProps = {
  visible: boolean;
  step?: 'permissions' | 'trust';
  status?: MobileAttendanceDeviceTrustStatus;
  staffName: string;
  deviceName: string;
  permissionState?: AttendancePermissionState;
  isChecking?: boolean;
  isSubmitting?: boolean;
  isRetrying?: boolean;
  isError?: boolean;
  notice?: {
    message: string;
    tone?: 'danger' | 'info' | 'success';
  } | null;
  isRequestingPermissions?: boolean;
  onAllowPermissions?: () => void;
  onOpenPermissionSettings?: () => void;
  onPermissionContinue?: () => void;
  onTrust: () => void;
  onTransfer: () => void;
  onRetry: () => void;
  onCancel: () => void;
};

export function AttendanceDeviceTrustModal({
  visible,
  step = 'trust',
  status,
  staffName,
  deviceName,
  permissionState,
  isChecking,
  isSubmitting,
  isRetrying,
  isError,
  notice,
  isRequestingPermissions,
  onAllowPermissions,
  onOpenPermissionSettings,
  onPermissionContinue,
  onTrust,
  onTransfer,
  onRetry,
  onCancel,
}: AttendanceDeviceTrustModalProps) {
  const showPrimaryAction = status === 'NO_TRUSTED_DEVICE' || status === 'DIFFERENT_DEVICE';
  const primaryLabel = status === 'DIFFERENT_DEVICE' ? 'Transfer to This Phone' : 'Trust This Phone';
  const primaryAction = status === 'DIFFERENT_DEVICE' ? onTransfer : onTrust;
  const heroImage = getDeviceTrustImage(status);
  const isPermissionStep = step === 'permissions';
  const permissionsReady = permissionState ? canUseAttendancePermissions(permissionState) : false;
  const shouldOpenPermissionSettings = needsAttendancePermissionSettings(permissionState);
  const isBusy = Boolean(isSubmitting || isRetrying || isRequestingPermissions);
  const contentKey = isPermissionStep ? 'permissions' : `trust-${status ?? 'unknown'}`;
  const permissionNotice = isPermissionStep ? getPermissionNotice(permissionState, shouldOpenPermissionSettings) : null;
  const showActionNotice = !isPermissionStep && status === 'DIFFERENT_DEVICE' && notice?.tone === 'danger';
  const activeNotice = showActionNotice ? null : notice ?? permissionNotice;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={isBusy ? undefined : onCancel}>
      <StatusBar style="dark" backgroundColor="#d9f4f7" />
      <LinearGradient
        colors={['#d9f4f7', '#edf9fb', '#f9fdfe', '#ffffff']}
        locations={[0, 0.38, 0.72, 1]}
        style={styles.screen}>
        <Animated.View
          key={`hero-${contentKey}`}
          entering={FadeIn.duration(180)}
          exiting={FadeOut.duration(120)}
          style={styles.topSection}>
          {isChecking && !isPermissionStep ? (
            <ActivityIndicator size={34} color={Colors.light.primary} />
          ) : (
            <Image source={isPermissionStep ? attendancePermissionsImage : heroImage} style={isPermissionStep ? styles.permissionImage : styles.image} />
          )}
        </Animated.View>

        <View style={styles.lowerPanel}>
          <View style={styles.stepDots}>
            <View style={[styles.stepDot, isPermissionStep && styles.stepDotActive]} />
            <View style={[styles.stepDot, !isPermissionStep && styles.stepDotActive]} />
          </View>
          <Animated.View
            key={`middle-${contentKey}`}
            entering={FadeIn.duration(180).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })}
            exiting={FadeOut.duration(120)}
            style={styles.middleSection}>
            <View style={styles.copy}>
              <Text style={styles.heading}>{isPermissionStep ? 'Allow Attendance Access' : getDeviceTrustTitle(status)}</Text>
              {!isPermissionStep && (
                <Text style={styles.message}>{getDeviceTrustDescription(status, isChecking)}</Text>
              )}
            </View>

            {isPermissionStep ? (
              <View style={styles.permissions}>
                <PermissionRow
                  icon="camera-outline"
                  label="Camera"
                  enabled={Boolean(permissionState?.cameraGranted)}
                />
                <PermissionRow
                  icon="map-marker-outline"
                  label="Location"
                  enabled={Boolean(permissionState?.locationGranted && permissionState?.locationServicesEnabled)}
                />
                <PermissionRow
                  icon="fingerprint"
                  label={permissionState?.biometricLabel ?? 'Biometrics'}
                  enabled={Boolean(permissionState?.biometricAvailable && permissionState?.biometricEnrolled)}
                />
              </View>
            ) : (
              <View style={styles.identity}>
                <View style={styles.identityItem}>
                  <Icon source="account-circle-outline" size={19} color={Colors.light.textSecondary} />
                  <Text style={styles.identityValue}>{staffName}</Text>
                </View>
                <View style={styles.identityDivider} />
                <View style={styles.identityItem}>
                  <Icon source="cellphone" size={19} color={Colors.light.textSecondary} />
                  <Text style={styles.identityValue}>{deviceName}</Text>
                </View>
              </View>
            )}

            {activeNotice && (
              <View style={[styles.notice, styles[`notice_${activeNotice.tone ?? 'info'}`]]}>
                <Text style={[styles.noticeText, styles[`noticeText_${activeNotice.tone ?? 'info'}`]]}>
                  {activeNotice.message}
                </Text>
              </View>
            )}
          </Animated.View>

          <View style={styles.bottomSection}>
            {isRequestingPermissions || isSubmitting ? (
              <View style={styles.submittingState}>
                <ActivityIndicator size={24} color={Colors.light.primary} />
              </View>
            ) : isPermissionStep ? (
              <AppButton
                onPress={permissionsReady ? onPermissionContinue : shouldOpenPermissionSettings ? onOpenPermissionSettings : onAllowPermissions}>
                {permissionsReady ? 'Continue' : shouldOpenPermissionSettings ? 'Open Settings' : 'Allow All'}
              </AppButton>
            ) : showActionNotice ? (
              <View style={styles.actionNotice}>
                <Text style={styles.actionNoticeText}>{notice.message}</Text>
              </View>
            ) : showPrimaryAction ? (
              <AppButton onPress={primaryAction}>
                {primaryLabel}
              </AppButton>
            ) : isError ? (
              <AppButton loading={isRetrying} disabled={isRetrying} onPress={onRetry}>
                Check Again
              </AppButton>
            ) : (
              <AppButton onPress={onCancel}>Close</AppButton>
            )}
            {!isSubmitting && !isRequestingPermissions && (
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                style={[styles.cancelButton, isBusy && styles.cancelButtonDisabled]}
                onPress={onCancel}>
                <Icon source="close" size={16} color={Colors.light.danger} />
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}

function PermissionRow({ icon, label, enabled }: { icon: string; label: string; enabled: boolean }) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionLabel}>
        <Icon source={icon} size={20} color={Colors.light.primary} />
        <Text style={styles.permissionText}>{label}</Text>
      </View>
      <View style={[styles.permissionSwitch, enabled && styles.permissionSwitchOn]}>
        <View style={[styles.permissionSwitchThumb, enabled && styles.permissionSwitchThumbOn]} />
      </View>
    </View>
  );
}

function getDeviceTrustTitle(status?: MobileAttendanceDeviceTrustStatus) {
  switch (status) {
    case 'NO_TRUSTED_DEVICE':
      return 'Trust Attendance Device';
    case 'DIFFERENT_DEVICE':
      return 'Transfer Attendance Device';
    case 'DEVICE_USED_BY_ANOTHER_STAFF':
      return 'Device Already Linked';
    case 'SAME_DEVICE':
      return 'Device Already Trusted';
    default:
      return 'Trust Attendance Device';
  }
}

function getDeviceTrustImage(status?: MobileAttendanceDeviceTrustStatus) {
  switch (status) {
    case 'DIFFERENT_DEVICE':
      return transferDeviceImage;
    case 'DEVICE_USED_BY_ANOTHER_STAFF':
      return deviceUsedByStaffImage;
    default:
      return trustDeviceImage;
  }
}

function getDeviceTrustDescription(status: MobileAttendanceDeviceTrustStatus | undefined, isChecking?: boolean) {
  if (isChecking) {
    return 'Checking whether this phone can be used for attendance.';
  }

  switch (status) {
    case 'NO_TRUSTED_DEVICE':
      return 'This device will be used to verify your attendance. Changing phones later requires a device transfer.';
    case 'DIFFERENT_DEVICE':
      return 'Your attendance is linked to another device. Transfer access before clocking in or out.';
    case 'DEVICE_USED_BY_ANOTHER_STAFF':
      return 'This device is already linked to another staff account. Contact admin support.';
    case 'SAME_DEVICE':
      return 'This phone is already trusted and can verify attendance.';
    default:
      return 'This device must be verified before attendance can be logged.';
  }
}

function getPermissionNotice(state: AttendancePermissionState | undefined, shouldOpenSettings: boolean) {
  if (!state || canUseAttendancePermissions(state)) {
    return null;
  }

  const missing = getMissingPermissionLabels(state);
  const permissionList = missing.length ? missing.join(', ') : 'attendance access';

  if (shouldOpenSettings) {
    return {
      message: `Open Settings to enable ${permissionList}.`,
      tone: 'danger' as const,
    };
  }

  return {
    message: `Allow ${permissionList} to continue.`,
    tone: 'info' as const,
  };
}

function getMissingPermissionLabels(state: AttendancePermissionState) {
  const missing: string[] = [];

  if (!state.cameraGranted) {
    missing.push('Camera');
  }

  if (!state.locationGranted || !state.locationServicesEnabled) {
    missing.push('Location');
  }

  if (!state.biometricAvailable || !state.biometricEnrolled) {
    missing.push(state.biometricLabel);
  }

  return missing;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.light.surface,
  },
  topSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.six,
  },
  image: {
    width: 156,
    height: 156,
    resizeMode: 'contain',
  },
  permissionImage: {
    width: 190,
    height: 126,
    resizeMode: 'contain',
  },
  lowerPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: '37%',
    borderTopLeftRadius: 44,
    borderTopRightRadius: 44,
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five + 5,
    paddingBottom: Spacing.four + 1,
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  stepDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#d8ecef',
  },
  stepDotActive: {
    width: 18,
    backgroundColor: Colors.light.primary,
  },
  middleSection: {
    gap: Spacing.three,
  },
  copy: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  heading: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    ...Typography.base,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  permissions: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  permissionRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: '#f4fbfc',
    paddingHorizontal: Spacing.four,
  },
  permissionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  permissionText: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '700',
  },
  permissionSwitch: {
    width: 42,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    backgroundColor: '#cbd8dc',
    paddingHorizontal: 3,
  },
  permissionSwitchOn: {
    backgroundColor: Colors.light.success,
  },
  permissionSwitchThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ffffff',
  },
  permissionSwitchThumbOn: {
    alignSelf: 'flex-end',
  },
  notice: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  notice_info: {
    backgroundColor: '#eef8fa',
    borderRadius: 12,
  },
  notice_danger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#f3c8c3',
  },
  notice_success: {
    backgroundColor: '#edf8f1',
    borderRadius: 12,
  },
  noticeText: {
    ...Typography.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
  noticeText_info: {
    color: Colors.light.primary,
  },
  noticeText_danger: {
    color: Colors.light.danger,
  },
  noticeText_success: {
    color: Colors.light.success,
  },
  actionNotice: {
    minHeight: 68,
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#f3c8c3',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  actionNoticeText: {
    ...Typography.sm,
    color: Colors.light.danger,
    textAlign: 'center',
    fontWeight: '600',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  identityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minWidth: 0,
    maxWidth: '44%',
  },
  identityDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#d8ecef',
  },
  identityValue: {
    ...Typography.sm,
    color: Colors.light.text,
    fontWeight: '600',
    flexShrink: 1,
  },
  bottomSection: {
    justifyContent: 'flex-end',
    gap: Spacing.two,
    minHeight: 106,
    paddingTop: Spacing.six,
  },
  submittingState: {
    minHeight: 90,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  cancelButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  cancelButtonDisabled: {
    opacity: 0.38,
  },
  cancelText: {
    ...Typography.sm,
    color: Colors.light.danger,
    fontWeight: '600',
  },
});
