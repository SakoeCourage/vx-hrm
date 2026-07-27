import {
  cancelLocalBiometricAuthentication,
  verifyLocalBiometric,
} from '@/lib/device/local-biometric';

const BIOMETRIC_SESSION_TTL_MS = 10 * 60 * 1000;

let verifiedAt: number | null = null;
let pendingVerification: Promise<void> | null = null;

export function markAttendanceBiometricVerified() {
  verifiedAt = Date.now();
}

export function hasValidAttendanceBiometricSession() {
  if (!verifiedAt) {
    return false;
  }

  const isFresh = Date.now() - verifiedAt <= BIOMETRIC_SESSION_TTL_MS;
  if (!isFresh) {
    verifiedAt = null;
  }

  return isFresh;
}

export function clearAttendanceBiometricSession() {
  verifiedAt = null;
}

export async function verifyAttendanceBiometricSession() {
  if (hasValidAttendanceBiometricSession()) {
    return;
  }

  if (!pendingVerification) {
    pendingVerification = verifyLocalBiometric()
      .then(markAttendanceBiometricVerified)
      .finally(() => {
        pendingVerification = null;
      });
  }

  await pendingVerification;
}

export async function cancelAttendanceBiometricVerification() {
  if (!pendingVerification) {
    return;
  }

  await cancelLocalBiometricAuthentication();
}
