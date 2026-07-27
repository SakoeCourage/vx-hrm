import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export async function verifyLocalBiometric() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const securityLevel = await LocalAuthentication.getEnrolledLevelAsync();

  console.log('[attendance-biometric] availability', {
    platform: Platform.OS,
    hasHardware,
    isEnrolled,
    supportedTypes: supportedTypes.map(formatAuthenticationType),
    securityLevel,
  });

  if (!hasHardware) {
    throw new Error('Biometric verification is not available on this device.');
  }

  if (!isEnrolled) {
    throw new Error('Set up Face ID, fingerprint, or device biometrics before clocking in or out.');
  }

  const hasFaceOrFingerprint =
    supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) ||
    supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

  if (!hasFaceOrFingerprint) {
    throw new Error('Face or fingerprint biometric is required to clock in or out.');
  }

  const hasFace = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: Platform.OS === 'ios' && hasFace ? 'Verify with Face ID' : 'Verify with biometrics',
    promptSubtitle: 'Required before attendance QR scan',
    promptDescription: 'Confirm it is you before clocking in or out.',
    cancelLabel: 'Cancel',
    fallbackLabel: Platform.OS === 'ios' ? '' : undefined,
    disableDeviceFallback: true,
    biometricsSecurityLevel: 'weak',
  });

  if (!result.success) {
    console.log('[attendance-biometric] authentication failed', {
      error: result.error,
      warning: result.warning,
      result,
    });
    throw new Error(getLocalAuthenticationErrorMessage(result.error));
  }
}

export async function cancelLocalBiometricAuthentication() {
  if (Platform.OS !== 'android') {
    return;
  }

  await LocalAuthentication.cancelAuthenticate();
}

function formatAuthenticationType(type: LocalAuthentication.AuthenticationType) {
  switch (type) {
    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
      return 'facial_recognition';
    case LocalAuthentication.AuthenticationType.FINGERPRINT:
      return 'fingerprint';
    case LocalAuthentication.AuthenticationType.IRIS:
      return 'iris';
    default:
      return `unknown_${type}`;
  }
}

function getLocalAuthenticationErrorMessage(error?: string) {
  switch (error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return 'Biometric verification was cancelled.';
    case 'authentication_failed':
      return 'Face or fingerprint verification failed. Please try again.';
    case 'not_enrolled':
      return 'Set up Face ID, fingerprint, or device biometrics before clocking in or out.';
    case 'not_available':
      return 'Biometric verification is not available on this device.';
    case 'passcode_not_set':
      return 'Set a device passcode before using biometric verification.';
    case 'lockout':
      return 'Biometric verification is locked. Unlock your device and try again.';
    case 'timeout':
      return 'Biometric verification timed out. Please try again.';
    case 'missing_usage_description':
      return 'Face ID is not configured in this app build. Rebuild the app with the Face ID usage description.';
    default:
      return error ? `Biometric verification failed: ${error}.` : 'Biometric verification was not completed.';
  }
}
