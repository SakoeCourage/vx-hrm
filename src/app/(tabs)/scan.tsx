import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet, View, type AppStateStatus } from 'react-native';
import { ActivityIndicator, Icon, Text } from 'react-native-paper';

import { AppButton, Screen } from '@/components/ui';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { AttendanceDeviceTrustModal } from '@/features/attendance/components/attendance-device-trust-modal';
import {
  getAttendanceStatus,
  logAttendance,
  validateMobileAttendanceDevice,
} from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';
import {
  cancelAttendanceBiometricVerification,
  clearAttendanceBiometricSession,
  hasValidAttendanceBiometricSession,
  markAttendanceBiometricVerified,
  verifyAttendanceBiometricSession,
} from '@/lib/device/attendance-biometric-gate';
import {
  AttendancePermissionState,
  canUseAttendancePermissions,
  getAttendancePermissionState,
  openAttendancePermissionSettings,
  requestAttendancePermissions,
} from '@/lib/device/attendance-permissions';
import {
  getMobileAttendanceDeviceMetadata,
  signMobileAttendanceChallenge,
  trustCurrentMobileAttendanceDevice,
  useAttendanceDeviceKeyId,
} from '@/lib/device/mobile-attendance-device';

const DEFAULT_QR_RADIUS_METERS = 100;
const MAX_CACHED_LOCATION_AGE_MS = 2 * 60 * 1000;
const INVALID_SCAN_LOCK_MS = 850;
const DUPLICATE_SCAN_IGNORE_MS = 1400;

type AttendanceQrTarget = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

type DeviceLocation = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

function getDeviceTrustBlockMessage(status: string) {
  switch (status) {
    case 'NO_TRUSTED_DEVICE':
      return 'Trust this phone from Home before clocking in or out.';
    case 'DIFFERENT_DEVICE':
      return 'Attendance is linked to another phone. Transfer it from Home before clocking in or out.';
    case 'DEVICE_USED_BY_ANOTHER_STAFF':
      return 'This phone is already linked to another staff account. Contact admin support.';
    default:
      return 'This phone must be trusted before attendance can be logged.';
  }
}

function formatSessionStaffName(session: { firstName?: string; lastName?: string; otherNames?: string; staffIdentificationNumber?: string } | null) {
  const name = [session?.firstName, session?.otherNames, session?.lastName].filter(Boolean).join(' ').trim();
  return name || session?.staffIdentificationNumber || 'Staff';
}

function parseAttendanceQrPayload(data: string): AttendanceQrTarget | null {
  const trimmed = data.trim();

  const fromJson = parseAttendanceQrJson(trimmed);
  if (fromJson) return fromJson;

  const fromUrl = parseAttendanceQrUrl(trimmed);
  if (fromUrl) return fromUrl;

  const csvMatch = trimmed.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?/);
  if (csvMatch) {
    return normalizeAttendanceQrTarget({
      latitude: Number(csvMatch[1]),
      longitude: Number(csvMatch[2]),
      radiusMeters: csvMatch[3] ? Number(csvMatch[3]) : DEFAULT_QR_RADIUS_METERS,
    });
  }

  return null;
}

function parseAttendanceQrJson(data: string) {
  try {
    const payload = JSON.parse(data);
    const source = payload.location ?? payload.coordinates ?? payload;
    return normalizeAttendanceQrTarget({
      latitude: source.latitude ?? source.lat,
      longitude: source.longitude ?? source.lng ?? source.lon,
      radiusMeters: source.radiusMeters ?? source.radius ?? source.allowedRadius ?? DEFAULT_QR_RADIUS_METERS,
    });
  } catch {
    return null;
  }
}

function parseAttendanceQrUrl(data: string) {
  try {
    const url = new URL(data);
    return normalizeAttendanceQrTarget({
      latitude: url.searchParams.get('latitude') ?? url.searchParams.get('lat'),
      longitude: url.searchParams.get('longitude') ?? url.searchParams.get('lng') ?? url.searchParams.get('lon'),
      radiusMeters: url.searchParams.get('radiusMeters') ?? url.searchParams.get('radius') ?? DEFAULT_QR_RADIUS_METERS,
    });
  } catch {
    return null;
  }
}

function normalizeAttendanceQrTarget({
  latitude,
  longitude,
  radiusMeters,
}: {
  latitude: unknown;
  longitude: unknown;
  radiusMeters: unknown;
}) {
  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  const parsedRadius = Number(radiusMeters);

  if (
    !Number.isFinite(parsedLatitude) ||
    !Number.isFinite(parsedLongitude) ||
    Math.abs(parsedLatitude) > 90 ||
    Math.abs(parsedLongitude) > 180
  ) {
    return null;
  }

  return {
    latitude: parsedLatitude,
    longitude: parsedLongitude,
    radiusMeters: Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : DEFAULT_QR_RADIUS_METERS,
  };
}

function getDistanceMeters(latA: number, lngA: number, latB: number, lngB: number) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(latA)) *
      Math.cos(toRadians(latB)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toDeviceLocation(location: Location.LocationObject): DeviceLocation {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    timestamp: location.timestamp,
  };
}

function isFreshLocation(location: DeviceLocation | null) {
  return Boolean(location && Date.now() - location.timestamp <= MAX_CACHED_LOCATION_AGE_MS);
}

function ScanToast({
  visible,
  message,
  tone,
  onDismiss,
}: {
  visible: boolean;
  message: string;
  tone: 'default' | 'success' | 'danger';
  onDismiss: () => void;
}) {
  if (!visible || !message) {
    return null;
  }

  return (
    <View style={[styles.scanToast, tone === 'danger' && styles.scanToastDanger, tone === 'success' && styles.scanToastSuccess]}>
      <Text style={styles.scanToastText}>{message}</Text>
      <Text style={styles.scanToastAction} onPress={onDismiss}>
        Dismiss
      </Text>
    </View>
  );
}

export default function ScanTab() {
  const { session } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const deviceKeyId = useAttendanceDeviceKeyId();
  const queryClient = useQueryClient();

  // Set default scanning mode to true so it opens camera instantly
  const [isScanning, setIsScanning] = useState(true);

  // Geolocation States
  const [locationName, setLocationName] = useState<string>('Locating...');
  const [, setLocationPermission] = useState<boolean | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<DeviceLocation | null>(null);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [locationCheckVersion, setLocationCheckVersion] = useState(0);
  const [scanOverlay, setScanOverlay] = useState<'loading' | 'success' | null>(null);
  const [isBiometricVerified, setIsBiometricVerified] = useState(() => hasValidAttendanceBiometricSession());
  const [isVerifyingBiometric, setIsVerifyingBiometric] = useState(false);
  const [biometricAttemptVersion, setBiometricAttemptVersion] = useState(0);
  const [deviceTrustModalVisible, setDeviceTrustModalVisible] = useState(false);
  const [attendanceAccessStep, setAttendanceAccessStep] = useState<'permissions' | 'trust'>('trust');
  const [attendancePermissionState, setAttendancePermissionState] = useState<AttendancePermissionState | undefined>();
  const [isRequestingAttendancePermissions, setIsRequestingAttendancePermissions] = useState(false);
  const [attendanceModalNotice, setAttendanceModalNotice] = useState<{
    message: string;
    tone?: 'danger' | 'info' | 'success';
  } | null>(null);

  // Toast message states
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarTone, setSnackbarTone] = useState<'default' | 'success' | 'danger'>('default');

  // Scanning laser animation value
  const scanAnim = useRef(new Animated.Value(10)).current;

  const staffId = session?.staffIdentificationNumber ?? '';
  const tenantId = session?.tenantId ?? '';
  const accessToken = session?.accessToken ?? '';
  const staffName = formatSessionStaffName(session);
  const attendanceDeviceName = getMobileAttendanceDeviceMetadata().deviceName ?? 'This phone';

  // Get current status to see if forceCheckIn is needed
  const statusQuery = useQuery({
    queryKey: ['attendance-status', tenantId, staffId],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getAttendanceStatus({
          staffIdentificationNumber: staffId,
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: Boolean(accessToken && tenantId && staffId),
  });

  const deviceTrustQuery = useQuery({
    queryKey: ['mobile-attendance-device', tenantId, staffId, deviceKeyId],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        validateMobileAttendanceDevice({
          staffIdentificationNumber: staffId,
          deviceKeyId: deviceKeyId ?? '',
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
        })
      ),
    enabled: Boolean(accessToken && tenantId && staffId && deviceKeyId),
    retry: false,
  });

  const trustDeviceMutation = useMutation({
    mutationFn: (purpose: 'TRUST' | 'TRANSFER') =>
      authenticatedRequest((activeSession) =>
        trustCurrentMobileAttendanceDevice({
          session: activeSession,
          deviceKeyId: deviceKeyId ?? '',
          purpose,
        })
      ),
    onSuccess: async () => {
      markAttendanceBiometricVerified();
      await queryClient.invalidateQueries({ queryKey: ['mobile-attendance-device'] });
      queryClient.setQueryData(['mobile-attendance-device', tenantId, staffId, deviceKeyId], {
        status: 'SAME_DEVICE',
      });
      setDeviceTrustModalVisible(false);
      scanLockRef.current = false;
      lastScanRef.current = null;
      setScanOverlay(null);
      setIsScanning(true);
      setIsBiometricVerified(hasValidAttendanceBiometricSession());
      setIsVerifyingBiometric(false);
      setBiometricAttemptVersion((current) => current + 1);
      setSnackbarTone('success');
      setSnackbarMessage('This phone is trusted for attendance.');
      setSnackbarVisible(true);
    },
    onError: (error) => {
      clearAttendanceBiometricSession();
      setIsBiometricVerified(false);
      setIsVerifyingBiometric(false);
      if (deviceTrustModalVisible) {
        setAttendanceModalNotice({
          message: error instanceof Error ? error.message : 'Unable to trust this phone.',
          tone: 'danger',
        });
        return;
      }

      setSnackbarTone('danger');
      setSnackbarMessage(error instanceof Error ? error.message : 'Unable to trust this phone.');
      setSnackbarVisible(true);
    },
  });

  const logMutation = useMutation({
    mutationFn: (forceCheckIn: boolean) =>
      authenticatedRequest(async (activeSession) => {
        if (!deviceKeyId) {
          throw new Error('This device is not ready for attendance verification. Please try again.');
        }

        const deviceTrust = deviceTrustQuery.data?.status
          ? deviceTrustQuery.data
          : await validateMobileAttendanceDevice({
              staffIdentificationNumber: staffId,
              deviceKeyId,
              accessToken: activeSession.accessToken,
              tenantId: activeSession.tenantId,
            });

        if (deviceTrust.status !== 'SAME_DEVICE') {
          throw new Error(getDeviceTrustBlockMessage(deviceTrust.status));
        }

        const signedChallenge = await signMobileAttendanceChallenge({
          session: activeSession,
          deviceKeyId,
          purpose: 'ATTENDANCE_LOG',
        });

        return logAttendance({
          accessToken: activeSession.accessToken,
          tenantId: activeSession.tenantId,
          payload: {
            staffIdentificationNumber: staffId,
            source: 'MOBILE',
            deviceKeyId,
            challengeId: signedChallenge.challengeId,
            signature: signedChallenge.signature,
            forceCheckIn,
          },
        });
      }),
    retry: false,
    onSuccess: () => {
      setScanOverlay('success');

      // Invalidate queries to refresh states across the app
      queryClient.invalidateQueries({ queryKey: ['attendance-status', tenantId, staffId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-records', tenantId, staffId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-calendar', tenantId, staffId] });
      queryClient.invalidateQueries({ queryKey: ['current-staff-roster', tenantId, staffId] });

      setTimeout(() => {
        scanLockRef.current = false;
        router.replace('/home');
      }, 720);
    },
    onError: (err: any) => {
      setScanOverlay(null);
      setSnackbarTone('danger');
      setSnackbarMessage(err?.message || 'Failed to verify attendance. Please try again.');
      setSnackbarVisible(true);
      setTimeout(() => {
        scanLockRef.current = false;
        setIsScanning(true);
      }, 1200);
    },
  });
  const attendanceActionText = statusQuery.data?.currentStatus === 'CHECKIN' ? 'Signing out from' : 'Signing in from';
  const deviceTrustStatus = deviceTrustQuery.data?.status;
  const canUseTrustedDevice = deviceTrustStatus === 'SAME_DEVICE';
  const canUseAttendanceAccess = attendancePermissionState
    ? canUseAttendancePermissions(attendancePermissionState)
    : false;
  const isFocused = useIsFocused();
  const focusResetCountRef = useRef(0);
  const deviceLocationRef = useRef<DeviceLocation | null>(null);
  const biometricAttemptRef = useRef<number | null>(null);
  const biometricAttemptSequenceRef = useRef(0);
  const biometricVerificationInFlightRef = useRef(false);
  const scanLockRef = useRef(false);
  const lastScanRef = useRef<{ data: string; timestamp: number } | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    deviceLocationRef.current = deviceLocation;
  }, [deviceLocation]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let isMounted = true;

    getAttendancePermissionState().then((permissions) => {
      if (!isMounted) {
        return;
      }

      setAttendancePermissionState(permissions);

      if (!canUseAttendancePermissions(permissions)) {
        scanLockRef.current = true;
        setIsScanning(false);
        setScanOverlay(null);
        setAttendanceAccessStep('permissions');
        setAttendanceModalNotice(null);
        setDeviceTrustModalVisible(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused || deviceTrustModalVisible || !canUseAttendanceAccess || !deviceTrustStatus || canUseTrustedDevice) {
      return;
    }

    scanLockRef.current = true;
    setIsScanning(false);
    setScanOverlay(null);
    setAttendanceAccessStep('trust');
    setAttendanceModalNotice(null);
    setDeviceTrustModalVisible(true);
  }, [canUseAttendanceAccess, canUseTrustedDevice, deviceTrustModalVisible, deviceTrustStatus, isFocused]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasMinimized = appStateRef.current === 'background';
      appStateRef.current = nextState;

      if (!isFocused || nextState !== 'active' || !wasMinimized) {
        return;
      }

      if (deviceTrustModalVisible && attendanceAccessStep === 'permissions') {
        getAttendancePermissionState()
          .then((permissions) => {
            setAttendancePermissionState(permissions);
            if (canUseAttendancePermissions(permissions)) {
              setAttendanceModalNotice(null);
            }
          })
          .catch(() => undefined);
        return;
      }

      const hasActiveBiometricSession = hasValidAttendanceBiometricSession();
      if (hasActiveBiometricSession) {
        return;
      }

      if (!canUseTrustedDevice || !canUseAttendanceAccess) {
        return;
      }

      scanLockRef.current = false;
      lastScanRef.current = null;
      setIsScanning(true);
      setScanOverlay(null);
      setSnackbarVisible(false);
      setSnackbarMessage('');
      setSnackbarTone('default');
      setLocationName('Locating...');
      setLocationPermission(null);
      setDeviceLocation(null);
      setIsResolvingLocation(false);
      setIsBiometricVerified(false);
      setIsVerifyingBiometric(false);
      setBiometricAttemptVersion((current) => current + 1);
      setLocationCheckVersion((current) => current + 1);
    });

    return () => subscription.remove();
  }, [attendanceAccessStep, canUseAttendanceAccess, canUseTrustedDevice, deviceTrustModalVisible, isFocused]);

  useEffect(() => {
    if (!isFocused) {
      biometricAttemptSequenceRef.current += 1;
      biometricVerificationInFlightRef.current = false;
      setIsVerifyingBiometric(false);
      void cancelAttendanceBiometricVerification();
      return;
    }

    focusResetCountRef.current += 1;

    if (focusResetCountRef.current > 1) {
      const hasActiveBiometricSession = canUseAttendanceAccess && canUseTrustedDevice && hasValidAttendanceBiometricSession();

      setIsScanning(true);
      setScanOverlay(null);
      setSnackbarVisible(false);
      setSnackbarMessage('');
      setSnackbarTone('default');
      scanLockRef.current = false;
      lastScanRef.current = null;
      setLocationName('Locating...');
      setLocationPermission(null);
      setDeviceLocation(null);
      setIsResolvingLocation(false);
      setIsBiometricVerified(hasActiveBiometricSession);
      setIsVerifyingBiometric(false);
      if (canUseAttendanceAccess && canUseTrustedDevice && !hasActiveBiometricSession) {
        setBiometricAttemptVersion((current) => current + 1);
      }
      setLocationCheckVersion((current) => current + 1);
    }
  }, [canUseAttendanceAccess, canUseTrustedDevice, isFocused]);

  useEffect(() => {
    if (
      !isFocused ||
      !canUseAttendanceAccess ||
      !canUseTrustedDevice ||
      isBiometricVerified ||
      biometricVerificationInFlightRef.current ||
      biometricAttemptRef.current === biometricAttemptVersion
    ) {
      return;
    }

    const attemptSequence = biometricAttemptSequenceRef.current + 1;
    biometricAttemptSequenceRef.current = attemptSequence;
    biometricAttemptRef.current = biometricAttemptVersion;
    biometricVerificationInFlightRef.current = true;

    (async () => {
      setIsVerifyingBiometric(true);

      try {
        await verifyAttendanceBiometricSession();
        if (biometricAttemptSequenceRef.current === attemptSequence) {
          setIsBiometricVerified(true);
          setSnackbarVisible(false);
        }
      } catch (error) {
        if (biometricAttemptSequenceRef.current === attemptSequence) {
          setIsBiometricVerified(false);
          setSnackbarTone('danger');
          setSnackbarMessage(error instanceof Error ? error.message : 'Biometric verification is required before scanning.');
          setSnackbarVisible(true);
        }
      } finally {
        if (biometricAttemptSequenceRef.current === attemptSequence) {
          biometricVerificationInFlightRef.current = false;
          setIsVerifyingBiometric(false);
        }
      }
    })();
  }, [biometricAttemptVersion, canUseAttendanceAccess, canUseTrustedDevice, isBiometricVerified, isFocused]);

  // Resolve location after identity is verified. Camera stays visible while this runs.
  useEffect(() => {
    if (!isFocused || !isBiometricVerified) {
      return;
    }

    let isMounted = true;

    (async () => {
      setIsResolvingLocation(true);

      try {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) {
          if (isMounted) {
            setLocationPermission(false);
            setDeviceLocation(null);
            setLocationName('Location services off');
          }
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isMounted) return;

        const isGranted = status === 'granted';
        setLocationPermission(isGranted);

        if (isGranted) {
          const cachedLocation = await Location.getLastKnownPositionAsync();
          if (!isMounted) return;

          const usableCachedLocation = cachedLocation ? toDeviceLocation(cachedLocation) : null;
          const resolvedLocation = cachedLocation && isFreshLocation(usableCachedLocation)
            ? cachedLocation
            : await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              });

          if (!isMounted) return;

          const currentDeviceLocation = toDeviceLocation(resolvedLocation);
          setDeviceLocation(currentDeviceLocation);
          const geocode = await Location.reverseGeocodeAsync({
            latitude: currentDeviceLocation.latitude,
            longitude: currentDeviceLocation.longitude,
          });

          if (!isMounted) return;

          if (geocode && geocode.length > 0) {
            const place = geocode[0];
            const nameStr = [place.city || place.subregion, place.isoCountryCode]
              .filter(Boolean)
              .join(', ');
            setLocationName(nameStr || `${currentDeviceLocation.latitude.toFixed(4)}, ${currentDeviceLocation.longitude.toFixed(4)}`);
          } else {
            setLocationName(`${currentDeviceLocation.latitude.toFixed(4)}, ${currentDeviceLocation.longitude.toFixed(4)}`);
          }
        } else {
          setLocationName('Permission denied');
        }
      } catch {
        if (isMounted) {
          setDeviceLocation(null);
          setLocationName('Location unavailable');
        }
      } finally {
        if (isMounted) {
          setIsResolvingLocation(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isBiometricVerified, isFocused, locationCheckVersion]);

  // Run the horizontal laser line animation back and forth
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (isScanning && canUseAttendanceAccess && isBiometricVerified) {
      scanAnim.setValue(10);
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, {
            toValue: 270,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanAnim, {
            toValue: 10,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else {
      scanAnim.setValue(10);
    }

    return () => {
      if (animLoop) {
        animLoop.stop();
      }
    };
  }, [canUseAttendanceAccess, isBiometricVerified, isScanning, scanAnim]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!isScanning || scanOverlay || logMutation.isPending || scanLockRef.current) return;

    const now = Date.now();
    const previousScan = lastScanRef.current;
    if (
      previousScan &&
      previousScan.data === data &&
      now - previousScan.timestamp < DUPLICATE_SCAN_IGNORE_MS
    ) {
      return;
    }

    lastScanRef.current = { data, timestamp: now };

    const deviceTrustStatus = deviceTrustQuery.data?.status;
    if (deviceTrustQuery.isError || (deviceTrustStatus && deviceTrustStatus !== 'SAME_DEVICE')) {
      scanLockRef.current = true;
      setIsScanning(false);
      setDeviceTrustModalVisible(true);
      setScanOverlay(null);
      return;
    }

    const target = parseAttendanceQrPayload(data);
    if (!target) {
      scanLockRef.current = true;
      setSnackbarTone('danger');
      setSnackbarMessage('This QR code does not contain valid attendance coordinates.');
      setSnackbarVisible(true);
      setTimeout(() => {
        scanLockRef.current = false;
      }, INVALID_SCAN_LOCK_MS);
      return;
    }

    scanLockRef.current = true;
    setIsScanning(false);
    setScanOverlay('loading');

    try {
      if (!deviceKeyId) {
        throw new Error('This device is not ready for attendance verification. Please try again.');
      }

      const latestDeviceTrustStatus = deviceTrustQuery.data?.status;
      if (latestDeviceTrustStatus && latestDeviceTrustStatus !== 'SAME_DEVICE') {
        setDeviceTrustModalVisible(true);
        throw new Error(getDeviceTrustBlockMessage(latestDeviceTrustStatus));
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Turn on Location Services before clocking in or out.');
      }

      const permissionResult = await Location.requestForegroundPermissionsAsync();
      if (!permissionResult.granted) {
        throw new Error('Location permission is required to verify this QR code.');
      }

      let currentLocation = deviceLocationRef.current;
      if (!isFreshLocation(currentLocation)) {
        const cachedLocation = await Location.getLastKnownPositionAsync();
        const usableCachedLocation = cachedLocation ? toDeviceLocation(cachedLocation) : null;
        currentLocation = isFreshLocation(usableCachedLocation)
          ? usableCachedLocation
          : toDeviceLocation(
              await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
              })
            );
        setDeviceLocation(currentLocation);
      }

      if (!currentLocation) {
        throw new Error('Location is still being resolved. Please scan again in a moment.');
      }

      const distanceMeters = getDistanceMeters(
        currentLocation.latitude,
        currentLocation.longitude,
        target.latitude,
        target.longitude
      );

      if (distanceMeters > target.radiusMeters) {
        throw new Error(`You are too far from this attendance point. Move within ${Math.round(target.radiusMeters)}m and scan again.`);
      }

      const hasMissed = statusQuery.data?.hasMissedCheckout ?? false;
      logMutation.mutate(hasMissed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not verify this attendance QR code.';
      setScanOverlay(null);
      setIsScanning(true);
      scanLockRef.current = false;
      setSnackbarTone('danger');
      setSnackbarMessage(message);
      setSnackbarVisible(true);
    }
  };

  const continueAfterAttendancePermissions = async () => {
    const permissions = await getAttendancePermissionState();
    setAttendancePermissionState(permissions);

    if (!canUseAttendancePermissions(permissions)) {
      setAttendanceModalNotice({
        message: 'Camera and location are required for attendance.',
        tone: 'danger',
      });
      return;
    }

    if (deviceTrustQuery.data?.status !== 'SAME_DEVICE') {
      setAttendanceModalNotice(null);
      setAttendanceAccessStep('trust');
      return;
    }

    setAttendanceModalNotice(null);
    setDeviceTrustModalVisible(false);
    scanLockRef.current = false;
    lastScanRef.current = null;
    setScanOverlay(null);
    setIsScanning(true);
    setIsBiometricVerified(hasValidAttendanceBiometricSession());
    setIsVerifyingBiometric(false);
    setBiometricAttemptVersion((current) => current + 1);
  };

  const handleAllowAttendancePermissions = async () => {
    setIsRequestingAttendancePermissions(true);
    setAttendanceModalNotice(null);

    try {
      const permissions = await requestAttendancePermissions();
      setAttendancePermissionState(permissions);

      if (canUseAttendancePermissions(permissions)) {
        await continueAfterAttendancePermissions();
        return;
      }

      setAttendanceModalNotice({
        message: 'Camera and location are required for attendance.',
        tone: 'danger',
      });
    } finally {
      setIsRequestingAttendancePermissions(false);
    }
  };

  const handleOpenAttendancePermissionSettings = async () => {
    try {
      setAttendanceModalNotice(null);
      await openAttendancePermissionSettings();
      const permissions = await getAttendancePermissionState();
      setAttendancePermissionState(permissions);
    } catch {
      setAttendanceModalNotice({
        message: 'Open Settings and allow camera, location, and biometrics for attendance.',
        tone: 'danger',
      });
    }
  };

  if (deviceTrustQuery.isLoading && !deviceTrustModalVisible) {
    return (
      <Screen backgroundColor={Colors.light.appBgLight} statusBarBackgroundColor={Colors.light.primary} statusBarStyle="light">
        <View style={styles.canvas}>
          <ActivityIndicator color={Colors.light.primary} />
          <Text style={styles.subtitle}>Checking attendance device</Text>
        </View>
      </Screen>
    );
  }

  if (canUseAttendanceAccess && canUseTrustedDevice && !isBiometricVerified) {
    return (
      <View style={styles.cameraContainer}>
        <View style={styles.biometricOverlay}>
          <View style={styles.overlayStatusBubble}>
            {isVerifyingBiometric ? (
              <ActivityIndicator size="large" color="#ffffff" />
            ) : (
              <Icon source="fingerprint" size={42} color="#ffffff" />
            )}
            <Text style={styles.overlayStatusText}>
              {isVerifyingBiometric ? 'Verifying identity' : 'Biometric verification required'}
            </Text>
            {!isVerifyingBiometric && (
              <AppButton
                variant="outline"
                icon="fingerprint"
                textColor="#ffffff"
                style={styles.biometricRetryButton}
                labelStyle={styles.biometricRetryLabel}
                onPress={() => {
                  setSnackbarVisible(false);
                  setBiometricAttemptVersion((current) => current + 1);
                }}>
                Verify again
              </AppButton>
            )}
          </View>
        </View>
        <ScanToast
          visible={snackbarVisible}
          message={snackbarMessage}
          tone={snackbarTone}
          onDismiss={() => setSnackbarVisible(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      {isFocused && canUseAttendanceAccess && canUseTrustedDevice && isBiometricVerified && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={isScanning ? handleBarcodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        />
      )}

      {/* Semi-transparent Overlay Mask with transparent cutout */}
      <View style={StyleSheet.absoluteFillObject}>
        {/* Top Mask */}
        <View style={styles.maskTop}>
          <View style={styles.locationBubble}>
            <Icon source="map-marker" size={14} color={Colors.light.primary} />
            <Text style={styles.locationBubbleText}>
              {attendanceActionText}: <Text style={styles.locationBold}>{locationName}</Text>
            </Text>
          </View>
        </View>

        {/* Middle row containing Left Mask, Centered Cutout, and Right Mask */}
        <View style={styles.maskMiddleRow}>
          <View style={styles.maskSide} />

          {/* Cutout Guide Box (250x250) */}
          <View style={styles.cutoutContainer}>
            {/* White corner guides */}
            <View style={[styles.corner, styles.topLeftCorner]} />
            <View style={[styles.corner, styles.topRightCorner]} />
            <View style={[styles.corner, styles.bottomLeftCorner]} />
            <View style={[styles.corner, styles.bottomRightCorner]} />

            {/* Animated Laser Line */}
            {isScanning && canUseTrustedDevice && isBiometricVerified && (
              <Animated.View
                style={[
                  styles.laserLine,
                  {
                    transform: [{ translateY: scanAnim }],
                  },
                ]}
              />
            )}
          </View>

          <View style={styles.maskSide} />
        </View>

        {/* Bottom Mask */}
        <View style={styles.maskBottom}>
          <Text style={styles.guideText}>Align QR code within the frame to scan</Text>
        </View>
      </View>

      {isResolvingLocation && !scanOverlay && (
        <View style={styles.locationCheckOverlay}>
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.locationCheckText}>Checking location...</Text>
        </View>
      )}

      {canUseAttendanceAccess && canUseTrustedDevice && !isBiometricVerified && !scanOverlay && (
        <View style={styles.biometricOverlay}>
          <View style={styles.overlayStatusBubble}>
            {isVerifyingBiometric ? (
              <ActivityIndicator size="large" color="#ffffff" />
            ) : (
              <Icon source="fingerprint" size={42} color="#ffffff" />
            )}
            <Text style={styles.overlayStatusText}>
              {isVerifyingBiometric ? 'Verifying identity' : 'Biometric verification required'}
            </Text>
            {!isVerifyingBiometric && (
              <AppButton
                variant="outline"
                icon="fingerprint"
                textColor="#ffffff"
                style={styles.biometricRetryButton}
                labelStyle={styles.biometricRetryLabel}
                onPress={() => {
                  setSnackbarVisible(false);
                  setIsBiometricVerified(false);
                  setBiometricAttemptVersion((current) => current + 1);
                }}>
                Verify again
              </AppButton>
            )}
          </View>
        </View>
      )}

      {scanOverlay === 'loading' && (
        <View style={styles.verificationOverlay}>
          <View style={styles.overlayStatusBubble}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.overlayStatusText}>Verifying attendance</Text>
          </View>
        </View>
      )}

      {scanOverlay === 'success' && (
        <View style={styles.verificationOverlay}>
          <View style={styles.successCheck}>
            <Icon source="check" size={58} color="#ffffff" />
          </View>
        </View>
      )}

      <ScanToast
        visible={snackbarVisible}
        message={snackbarMessage}
        tone={snackbarTone}
        onDismiss={() => setSnackbarVisible(false)}
      />
      <AttendanceDeviceTrustModal
        visible={deviceTrustModalVisible}
        step={attendanceAccessStep}
        status={deviceTrustQuery.data?.status}
        staffName={staffName}
        deviceName={attendanceDeviceName}
        permissionState={attendancePermissionState}
        isChecking={deviceTrustQuery.isLoading}
        isSubmitting={trustDeviceMutation.isPending}
        isRetrying={deviceTrustQuery.isFetching}
        isError={deviceTrustQuery.isError}
        notice={attendanceModalNotice}
        isRequestingPermissions={isRequestingAttendancePermissions}
        onAllowPermissions={handleAllowAttendancePermissions}
        onOpenPermissionSettings={handleOpenAttendancePermissionSettings}
        onPermissionContinue={continueAfterAttendancePermissions}
        onTrust={() => trustDeviceMutation.mutate('TRUST')}
        onTransfer={() => trustDeviceMutation.mutate('TRANSFER')}
        onRetry={() => deviceTrustQuery.refetch()}
        onCancel={() => {
          setAttendanceModalNotice(null);
          setDeviceTrustModalVisible(false);
          scanLockRef.current = false;
          router.replace('/home');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
    minHeight: 560,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  iconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.primaryMuted,
  },
  title: {
    ...Typography.xl,
    color: Colors.light.text,
    fontWeight: '600',
    marginTop: Spacing.two,
  },
  subtitle: {
    ...Typography.base,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: Spacing.two,
  },
  // Camera view layout styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },

  // Dark Mask Grid Styles
  maskTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: Spacing.four,
  },
  maskMiddleRow: {
    flexDirection: 'row',
    height: 280,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  cutoutContainer: {
    width: 280,
    height: 280,
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  maskBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    paddingTop: Spacing.four,
  },
  guideText: {
    ...Typography.sm,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },

  // Location Bubble styles
  locationBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.one,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  locationBubbleText: {
    ...Typography.sm,
    color: '#ffffff',
  },
  locationBold: {
    fontWeight: '700',
    color: Colors.light.primary,
  },

  // Corner Guides styling
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.light.primary,
    borderWidth: 4,
  },
  topLeftCorner: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRightCorner: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeftCorner: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRightCorner: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },

  // Animation visual lasers
  laserLine: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    height: 2.5,
    backgroundColor: Colors.light.primary,
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 4,
  },

  verificationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  biometricOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    zIndex: 22,
  },
  locationCheckOverlay: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    bottom: 132,
    zIndex: 18,
    minHeight: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(8, 125, 150, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  locationCheckText: {
    ...Typography.sm,
    color: '#ffffff',
    fontWeight: '600',
  },
  overlayStatusBubble: {
    minWidth: 168,
    minHeight: 136,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.four,
  },
  overlayStatusText: {
    ...Typography.base,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  biometricRetryButton: {
    borderColor: 'rgba(255, 255, 255, 0.42)',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  biometricRetryLabel: {
    color: '#ffffff',
  },
  successCheck: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.success,
    borderWidth: 8,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  scanToast: {
    position: 'absolute',
    top: 58,
    left: Spacing.four,
    right: Spacing.four,
    zIndex: 40,
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: 'rgba(30, 61, 68, 0.94)',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  scanToastDanger: {
    backgroundColor: Colors.light.danger,
  },
  scanToastSuccess: {
    backgroundColor: Colors.light.success,
  },
  scanToastText: {
    ...Typography.sm,
    flex: 1,
    color: '#ffffff',
    fontWeight: '500',
  },
  scanToastAction: {
    ...Typography.xs,
    color: '#ffffff',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
