import { Camera } from 'expo-camera';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type AttendancePermissionState = {
  biometricAvailable: boolean;
  biometricEnrolled: boolean;
  biometricLabel: string;
  cameraGranted: boolean;
  cameraCanAskAgain: boolean;
  locationGranted: boolean;
  locationCanAskAgain: boolean;
  locationServicesEnabled: boolean;
};

export function canUseAttendancePermissions(state: AttendancePermissionState) {
  return (
    state.cameraGranted &&
    state.locationGranted &&
    state.locationServicesEnabled &&
    state.biometricAvailable &&
    state.biometricEnrolled
  );
}

export async function getAttendancePermissionState(): Promise<AttendancePermissionState> {
  const [cameraPermission, locationPermission, locationServicesEnabled, biometricState] = await Promise.all([
    Camera.getCameraPermissionsAsync(),
    Location.getForegroundPermissionsAsync(),
    Location.hasServicesEnabledAsync(),
    getAttendanceBiometricState(),
  ]);

  return {
    ...biometricState,
    cameraGranted: cameraPermission.granted,
    cameraCanAskAgain: cameraPermission.canAskAgain,
    locationGranted: locationPermission.granted,
    locationCanAskAgain: locationPermission.canAskAgain,
    locationServicesEnabled,
  };
}

export async function requestAttendancePermissions(): Promise<AttendancePermissionState> {
  const currentCameraPermission = await Camera.getCameraPermissionsAsync();
  const cameraPermission = currentCameraPermission.granted || !currentCameraPermission.canAskAgain
    ? currentCameraPermission
    : await Camera.requestCameraPermissionsAsync();
  const locationServicesEnabled = await Location.hasServicesEnabledAsync();
  const currentLocationPermission = await Location.getForegroundPermissionsAsync();
  const locationPermission = locationServicesEnabled && !currentLocationPermission.granted && currentLocationPermission.canAskAgain
    ? await Location.requestForegroundPermissionsAsync()
    : currentLocationPermission;
  const biometricState = await getAttendanceBiometricState();

  return {
    ...biometricState,
    cameraGranted: cameraPermission.granted,
    cameraCanAskAgain: cameraPermission.canAskAgain,
    locationGranted: locationPermission.granted,
    locationCanAskAgain: locationPermission.canAskAgain,
    locationServicesEnabled,
  };
}

export function needsAttendancePermissionSettings(state?: AttendancePermissionState) {
  if (!state) {
    return false;
  }

  return (
    (!state.cameraGranted && !state.cameraCanAskAgain) ||
    (!state.locationGranted && !state.locationCanAskAgain) ||
    !state.locationServicesEnabled ||
    !state.biometricAvailable ||
    !state.biometricEnrolled
  );
}

export async function openAttendancePermissionSettings() {
  await Linking.openSettings();
}

async function getAttendanceBiometricState() {
  const [biometricAvailable, biometricEnrolled, supportedTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  return {
    biometricAvailable,
    biometricEnrolled,
    biometricLabel: getBiometricLabel(supportedTypes),
  };
}

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return Platform.OS === 'ios' ? 'Face ID' : 'Face';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
    return 'Iris';
  }

  return 'Biometrics';
}
