import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';

import { AppBottomSheet, AppButton, AppSnackbar, Screen } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { AttendanceDeviceTrustModal } from '@/features/attendance/components/attendance-device-trust-modal';
import {
  getMobileAttendanceTrustedDeviceSummary,
  MobileAttendanceDeviceTrustStatus,
  MobileAttendanceTrustedDevice,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import {
  getMobileAttendanceDeviceMetadata,
  removeCurrentTrustedMobileAttendanceDevice,
  trustCurrentMobileAttendanceDevice,
  useAttendanceDeviceKeyId,
} from '@/lib/device/mobile-attendance-device';

type ToastState = {
  visible: boolean;
  message: string;
  tone: 'default' | 'success' | 'danger';
};

export default function TrustedDevicesScreen() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const deviceKeyId = useAttendanceDeviceKeyId();
  const editSheetRef = useRef<BottomSheetModal>(null);
  const [trustModalVisible, setTrustModalVisible] = useState(false);
  const [toast, setToast] = useState<ToastState>({
    visible: false,
    message: '',
    tone: 'default',
  });

  const staffId = session?.staffIdentificationNumber ?? '';
  const accessToken = session?.accessToken ?? '';
  const tenantId = session?.tenantId ?? '';
  const staffName = [session?.firstName, session?.lastName].filter(Boolean).join(' ') || staffId;
  const deviceName = getMobileAttendanceDeviceMetadata().deviceName ?? 'This phone';
  const deviceTrustKey = ['mobile-attendance-device', tenantId, staffId, deviceKeyId];
  const deviceSummaryKey = ['mobile-attendance-device-summary', tenantId, staffId, deviceKeyId];

  const deviceSummaryQuery = useQuery({
    queryKey: deviceSummaryKey,
    queryFn: () =>
      getMobileAttendanceTrustedDeviceSummary({
        accessToken,
        tenantId,
        staffIdentificationNumber: staffId,
        deviceKeyId: deviceKeyId ?? '',
      }),
    enabled: Boolean(accessToken && tenantId && staffId && deviceKeyId),
  });
  const trustStatus = deviceSummaryQuery.data?.status;
  const isTrusted = trustStatus === 'SAME_DEVICE';

  const trustDeviceMutation = useMutation({
    mutationFn: (purpose: 'TRUST' | 'TRANSFER') => {
      if (!session) {
        throw new Error('Sign in again to manage trusted devices.');
      }

      return trustCurrentMobileAttendanceDevice({
        session,
        deviceKeyId: deviceKeyId ?? '',
        purpose,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-attendance-device'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-attendance-device-summary'] });
      setTrustModalVisible(false);
      setToast({
        visible: true,
        message: 'This phone is trusted for attendance.',
        tone: 'success',
      });
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : 'Unable to update trusted device.',
        tone: 'danger',
      });
    },
  });

  const removeDeviceMutation = useMutation({
    mutationFn: () => {
      if (!session) {
        throw new Error('Sign in again to manage trusted devices.');
      }

      if (!deviceKeyId) {
        throw new Error('This phone is still preparing attendance verification. Please try again.');
      }

      return removeCurrentTrustedMobileAttendanceDevice({
        session,
        deviceKeyId,
        reason: 'User removed this phone',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mobile-attendance-device'] });
      await queryClient.invalidateQueries({ queryKey: ['mobile-attendance-device-summary'] });
      queryClient.setQueryData(deviceTrustKey, {
        status: 'NO_TRUSTED_DEVICE',
      });
      setToast({
        visible: true,
        message: 'This phone was removed from attendance devices.',
        tone: 'success',
      });
    },
    onError: (error) => {
      setToast({
        visible: true,
        message: error instanceof Error ? error.message : 'Unable to remove this phone.',
        tone: 'danger',
      });
    },
  });

  const isLoading = deviceSummaryQuery.isLoading || !deviceKeyId;
  const canOpenTrustFlow =
    trustStatus === 'NO_TRUSTED_DEVICE' ||
    trustStatus === 'SAME_DEVICE' ||
    trustStatus === 'DIFFERENT_DEVICE' ||
    trustStatus === 'DEVICE_USED_BY_ANOTHER_STAFF';
  const activeTrustedDevice = deviceSummaryQuery.data?.activeTrustedDevice ?? null;
  const recentDevices = deviceSummaryQuery.data?.recentDevices ?? [];

  if (!session) {
    return <Redirect href="/" />;
  }

  const handlePrimaryAction = () => {
    if (!deviceKeyId) {
      setToast({
        visible: true,
        message: 'This phone is still preparing attendance verification. Please try again.',
        tone: 'danger',
      });
      return;
    }

    if (canOpenTrustFlow) {
      setTrustModalVisible(true);
      return;
    }

    void deviceSummaryQuery.refetch();
  };

  const handleTrustDevice = () => {
    if (!deviceKeyId) {
      setToast({
        visible: true,
        message: 'This phone is still preparing attendance verification. Please try again.',
        tone: 'danger',
      });
      return;
    }

    trustDeviceMutation.mutate(trustStatus === 'DIFFERENT_DEVICE' ? 'TRANSFER' : 'TRUST');
  };

  const handleRemoveTrustedDevice = () => {
    if (!isTrusted) {
      return;
    }

    Alert.alert(
      'Remove trusted device?',
      'This phone will no longer be allowed to verify attendance until it is trusted again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeDeviceMutation.mutate(),
        },
      ]
    );
  };

  const handleTransferFromSheet = () => {
    editSheetRef.current?.dismiss();
    setTrustModalVisible(true);
  };

  const handleRemoveFromSheet = () => {
    editSheetRef.current?.dismiss();
    handleRemoveTrustedDevice();
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
          <Text style={styles.appBarTitle}>Trusted devices</Text>
          <View style={styles.appBarSpacer} />
        </View>
      }
      statusBarBackgroundColor={Colors.light.primary}
      statusBarStyle="light">
      <View style={styles.mainContent}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>Attendance Devices</Text>
          <Text style={styles.introText}>Only one active phone can verify attendance.</Text>
        </View>

        <View style={styles.deviceList}>
          <View style={styles.listHeader}>
            <Text style={styles.sectionTitle}>Your devices</Text>
            {deviceSummaryQuery.isFetching && !isLoading && (
              <ActivityIndicator size={16} color={Colors.light.primary} />
            )}
          </View>

          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size={18} color={Colors.light.primary} />
              <Text style={styles.loadingText}>Checking devices</Text>
            </View>
          ) : recentDevices.length > 0 ? (
            recentDevices.map((device) => {
              const isCurrentTrustedDevice = isTrusted && device.isActive && device.isCurrentDevice;

              return (
                <TrustedDeviceRow
                  key={device.id}
                  device={device}
                  actionLabel={device.isActive ? (isCurrentTrustedDevice ? 'Remove' : 'Add') : undefined}
                  actionTone={isCurrentTrustedDevice ? 'danger' : 'primary'}
                  onAction={
                    device.isActive
                      ? isCurrentTrustedDevice
                        ? handleRemoveTrustedDevice
                        : handlePrimaryAction
                      : undefined
                  }
                />
              );
            })
          ) : (
            <EmptyDeviceRow onAdd={handlePrimaryAction} />
          )}
        </View>

        {!isLoading &&
          recentDevices.length > 0 &&
          !activeTrustedDevice &&
          trustStatus !== 'DEVICE_USED_BY_ANOTHER_STAFF' && (
          <View style={styles.currentDeviceRow}>
            <View style={styles.deviceIcon}>
              <Icon source="cellphone-plus" size={22} color={Colors.light.primary} />
            </View>
            <View style={styles.deviceText}>
              <Text style={styles.deviceName}>{deviceName}</Text>
              <Text style={styles.deviceSubtitle}>Current phone</Text>
            </View>
            <Pressable accessibilityRole="button" style={styles.outlineActionButton} onPress={handlePrimaryAction}>
              <Text style={styles.primaryPillText}>Trust</Text>
            </Pressable>
          </View>
        )}

        {!isLoading && recentDevices.length > 0 && trustStatus === 'DEVICE_USED_BY_ANOTHER_STAFF' && (
          <View style={styles.currentDeviceRow}>
            <View style={styles.deviceIconDanger}>
              <Icon source="cellphone-alert" size={22} color={Colors.light.danger} />
            </View>
            <View style={styles.deviceText}>
              <Text style={styles.deviceName}>{deviceName}</Text>
              <Text style={styles.deviceSubtitle}>Current phone</Text>
            </View>
            <View style={[styles.statusPill, styles.dangerPill]}>
              <Text style={[styles.statusPillText, styles.dangerPillText]}>Linked</Text>
            </View>
          </View>
        )}
      </View>

      <AttendanceDeviceTrustModal
        visible={trustModalVisible}
        status={trustStatus}
        staffName={staffName}
        deviceName={deviceName}
        isChecking={deviceSummaryQuery.isLoading}
        isSubmitting={trustDeviceMutation.isPending}
        isRetrying={deviceSummaryQuery.isFetching}
        isError={deviceSummaryQuery.isError}
        onTrust={handleTrustDevice}
        onTransfer={handleTrustDevice}
        onRetry={() => deviceSummaryQuery.refetch()}
        onCancel={() => setTrustModalVisible(false)}
      />

      <AppBottomSheet
        ref={editSheetRef}
        snapPoints={['30%']}
        title="Attendance device"
        subtitle={getEditSheetSubtitle(trustStatus, activeTrustedDevice ?? undefined, deviceName)}>
        {trustStatus === 'DIFFERENT_DEVICE' && (
          <AppButton icon="cellphone-arrow-down" onPress={handleTransferFromSheet}>
            Transfer to this phone
          </AppButton>
        )}
        {trustStatus === 'SAME_DEVICE' && (
          <AppButton
            icon="trash-can-outline"
            variant="danger"
            loading={removeDeviceMutation.isPending}
            disabled={removeDeviceMutation.isPending}
            onPress={handleRemoveFromSheet}>
            Remove trusted device
          </AppButton>
        )}
        <AppButton variant="ghost" onPress={() => editSheetRef.current?.dismiss()}>
          Cancel
        </AppButton>
      </AppBottomSheet>

      <AppSnackbar
        visible={toast.visible}
        message={toast.message}
        tone={toast.tone}
        onDismiss={() => setToast((current) => ({ ...current, visible: false }))}
      />
    </Screen>
  );
}

function TrustedDeviceRow({
  device,
  actionLabel,
  actionTone = 'primary',
  onAction,
}: {
  device: MobileAttendanceTrustedDevice;
  actionLabel?: string;
  actionTone?: 'primary' | 'danger';
  onAction?: () => void;
}) {
  const isRevoked = Boolean(device.revokedAt);
  const statusLabel = device.isActive ? 'Trusted' : isRevoked ? 'Removed' : 'Recent';

  return (
    <View style={styles.deviceRow}>
      <View style={styles.deviceIcon}>
        <Icon source={getDeviceIcon(device.platform)} size={22} color={Colors.light.primary} />
      </View>
      <View style={styles.deviceText}>
        <Text style={styles.deviceName} numberOfLines={1}>
          {device.deviceName || formatPlatform(device.platform)}
        </Text>
        <Text style={styles.deviceSubtitle} numberOfLines={1}>
          {formatDeviceSubtitle(device)}
        </Text>
      </View>
      {onAction && actionLabel ? (
        <Pressable
          accessibilityRole="button"
          style={[styles.editButton, actionTone === 'danger' && styles.dangerActionButton]}
          onPress={onAction}>
          <Text style={[styles.editButtonText, actionTone === 'danger' && styles.dangerActionText]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : isRevoked ? (
        <View style={styles.emptyActionSlot} />
      ) : (
        <View style={[styles.statusPill, device.isActive ? styles.successPill : isRevoked ? styles.dangerPill : styles.neutralPill]}>
          <Text style={[styles.statusPillText, device.isActive ? styles.successPillText : isRevoked ? styles.dangerPillText : styles.neutralPillText]}>
            {statusLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

function EmptyDeviceRow({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.deviceRow}>
      <View style={styles.deviceIconMuted}>
        <Icon source="cellphone-off" size={22} color={Colors.light.textSecondary} />
      </View>
      <View style={styles.deviceText}>
        <Text style={styles.deviceName}>No trusted device</Text>
        <Text style={styles.deviceSubtitle}>Add this phone to use attendance</Text>
      </View>
      <Pressable accessibilityRole="button" style={styles.editButton} onPress={onAdd}>
        <Text style={styles.editButtonText}>Add</Text>
      </Pressable>
    </View>
  );
}

function getEditSheetSubtitle(
  status: MobileAttendanceDeviceTrustStatus | undefined,
  currentDevice: MobileAttendanceTrustedDevice | undefined,
  fallbackDeviceName: string
) {
  if (status === 'SAME_DEVICE') {
    return currentDevice?.deviceName || fallbackDeviceName;
  }

  if (status === 'DIFFERENT_DEVICE') {
    return 'Move attendance access to this phone.';
  }

  return undefined;
}

function getDeviceIcon(platform?: string) {
  const normalized = platform?.toLowerCase();

  if (normalized === 'ios') {
    return 'cellphone-iphone';
  }

  if (normalized === 'android') {
    return 'cellphone';
  }

  return 'devices';
}

function formatPlatform(platform?: string) {
  if (!platform) {
    return 'Mobile device';
  }

  return platform.toLowerCase() === 'ios' ? 'iPhone' : `${platform.charAt(0).toUpperCase()}${platform.slice(1)}`;
}

function formatDeviceSubtitle(device: MobileAttendanceTrustedDevice) {
  const identity = device.isCurrentDevice
    ? 'This phone'
    : device.maskedDeviceKeyId || formatPlatform(device.platform);
  const dateLabel = getDeviceDateLabel(device);

  return dateLabel ? `${identity} • ${dateLabel}` : identity;
}

function getDeviceDateLabel(device: MobileAttendanceTrustedDevice) {
  if (device.revokedAt) {
    return `Removed ${formatDeviceDate(device.revokedAt)}`;
  }

  if (device.trustedAt) {
    return `Trusted ${formatDeviceDate(device.trustedAt)}`;
  }

  if (device.lastVerifiedAt) {
    return `Verified ${formatDeviceDate(device.lastVerifiedAt)}`;
  }

  return null;
}

function formatDeviceDate(value?: string | null) {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    flexGrow: 1,
    justifyContent: 'space-between',
    gap: Spacing.five,
    paddingTop: Spacing.six,
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
  mainContent: {
    gap: Spacing.four,
  },
  intro: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  introTitle: {
    ...Typography.lg,
    color: Colors.light.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  introText: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  deviceList: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  listHeader: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.border,
  },
  sectionTitle: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  deviceRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  currentDeviceRow: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  deviceIconMuted: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.secondaryMuted,
  },
  deviceIconDanger: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.dangerMuted,
  },
  deviceText: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    ...Typography.base,
    color: Colors.light.text,
    fontWeight: '700',
  },
  deviceSubtitle: {
    ...Typography.sm,
    color: Colors.light.textSecondary,
  },
  statusPill: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    backgroundColor: Colors.light.surface,
    borderWidth: 1,
    borderColor: Colors.light.secondary,
  },
  statusPillText: {
    ...Typography.xs,
    fontWeight: '700',
    color: Colors.light.secondary,
  },
  editButton: {
    minWidth: 58,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.primary,
  },
  emptyActionSlot: {
    minWidth: 58,
    minHeight: 32,
  },
  dangerActionButton: {
    borderColor: Colors.light.danger,
  },
  outlineActionButton: {
    minWidth: 68,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.primary,
    backgroundColor: Colors.light.surface,
  },
  editButtonText: {
    ...Typography.sm,
    color: Colors.light.primary,
    fontWeight: '700',
  },
  dangerActionText: {
    color: Colors.light.danger,
  },
  primaryPill: {
    minWidth: 68,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Colors.light.primary,
  },
  primaryPillText: {
    ...Typography.sm,
    color: Colors.light.primary,
    fontWeight: '700',
  },
  neutralPill: {
    borderColor: Colors.light.secondary,
  },
  neutralPillText: {
    color: Colors.light.secondary,
  },
  successPill: {
    borderColor: Colors.light.success,
  },
  successPillText: {
    color: Colors.light.success,
  },
  dangerPill: {
    borderColor: Colors.light.danger,
  },
  dangerPillText: {
    color: Colors.light.danger,
  },
  loadingRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: 8,
    backgroundColor: Colors.light.primaryMuted,
  },
  loadingText: {
    ...Typography.base,
    color: Colors.light.primary,
    fontWeight: '600',
  },
  actionStack: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
});
