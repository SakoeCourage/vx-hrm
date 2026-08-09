import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import { NativeModules, Platform } from 'react-native';
import ReactNativeBiometrics from 'react-native-biometrics';

import {
  createMobileAttendanceDeviceChallenge,
  getCurrentMobileAttendanceTrustedDevice,
  MobileAttendanceDeviceChallengePurpose,
  MobileAttendanceDeviceMetadata,
  MobileAttendanceDeviceTrustPayload,
  removeCurrentMobileAttendanceDevice,
  transferMobileAttendanceDevice,
  trustMobileAttendanceDevice,
} from '@/lib/auth/api';
import { StaffSession } from '@/lib/auth/types';

const DEVICE_KEY_ID_KEY = 'vx_hrm_mobile_attendance_device_key_id';
const DEVICE_PUBLIC_KEY_KEY = 'vx_hrm_mobile_attendance_public_key';

const rnBiometrics = new ReactNativeBiometrics();

export function useAttendanceDeviceKeyId(): string | null {
  const [deviceKeyId, setDeviceKeyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getOrCreateAttendanceDeviceKeyId()
      .then((id) => {
        if (!cancelled) {
          setDeviceKeyId(id);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDeviceKeyId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return deviceKeyId;
}

export async function getOrCreateAttendanceDeviceKeyId() {
  let deviceKeyId = await SecureStore.getItemAsync(DEVICE_KEY_ID_KEY);

  if (!deviceKeyId) {
    deviceKeyId = generateUUID();
    await SecureStore.setItemAsync(DEVICE_KEY_ID_KEY, deviceKeyId);
  }

  return deviceKeyId;
}

export async function ensureMobileAttendancePublicKey() {
  ensureBiometricsNativeModule();

  const { available, error } = await rnBiometrics.isSensorAvailable();

  if (!available) {
    throw new Error(error || 'Biometric signing is not available on this device.');
  }

  const { keysExist } = await rnBiometrics.biometricKeysExist();
  const storedPublicKey = await SecureStore.getItemAsync(DEVICE_PUBLIC_KEY_KEY);

  if (keysExist && storedPublicKey) {
    return storedPublicKey;
  }

  const { publicKey } = await rnBiometrics.createKeys();
  await SecureStore.setItemAsync(DEVICE_PUBLIC_KEY_KEY, publicKey);
  return publicKey;
}

export async function signMobileAttendanceMessage(messageToSign: string) {
  ensureBiometricsNativeModule();

  const { success, signature, error } = await rnBiometrics.createSignature({
    promptMessage: 'Verify attendance device',
    payload: messageToSign,
  });

  if (!success || !signature) {
    throw new Error(error || 'Device verification was cancelled.');
  }

  return signature;
}

export async function signMobileAttendanceChallenge({
  session,
  deviceKeyId,
  purpose,
}: {
  session: StaffSession;
  deviceKeyId: string;
  purpose: MobileAttendanceDeviceChallengePurpose;
}) {
  const challenge = await createMobileAttendanceDeviceChallenge({
    staffIdentificationNumber: session.staffIdentificationNumber,
    deviceKeyId,
    purpose,
    accessToken: session.accessToken,
    tenantId: session.tenantId,
  });
  const signature = await signMobileAttendanceMessage(challenge.messageToSign);

  return {
    challengeId: challenge.challengeId,
    signature,
  };
}

export async function trustCurrentMobileAttendanceDevice({
  session,
  deviceKeyId,
  purpose,
}: {
  session: StaffSession;
  deviceKeyId: string;
  purpose: 'TRUST' | 'TRANSFER';
}) {
  const publicKey = await ensureMobileAttendancePublicKey();
  const signedChallenge = await signMobileAttendanceChallenge({
    session,
    deviceKeyId,
    purpose,
  });
  const payload: MobileAttendanceDeviceTrustPayload = {
    staffIdentificationNumber: session.staffIdentificationNumber,
    deviceKeyId,
    publicKey,
    challengeId: signedChallenge.challengeId,
    signature: signedChallenge.signature,
    metadata: getMobileAttendanceDeviceMetadata(),
  };

  if (purpose === 'TRANSFER') {
    return transferMobileAttendanceDevice({
      accessToken: session.accessToken,
      tenantId: session.tenantId,
      payload,
    });
  }

  return trustMobileAttendanceDevice({
    accessToken: session.accessToken,
    tenantId: session.tenantId,
    payload,
  });
}

export async function removeCurrentTrustedMobileAttendanceDevice({
  session,
  deviceKeyId,
  reason = 'User removed this phone',
}: {
  session: StaffSession;
  deviceKeyId: string;
  reason?: string;
}) {
  const signedChallenge = await signMobileAttendanceChallenge({
    session,
    deviceKeyId,
    purpose: 'REMOVE',
  });

  return removeCurrentMobileAttendanceDevice({
    accessToken: session.accessToken,
    tenantId: session.tenantId,
    payload: {
      staffIdentificationNumber: session.staffIdentificationNumber,
      deviceKeyId,
      challengeId: signedChallenge.challengeId,
      signature: signedChallenge.signature,
      reason,
    },
  });
}

export async function getCurrentTrustedMobileAttendanceDevice({
  session,
  deviceKeyId,
}: {
  session: StaffSession;
  deviceKeyId: string;
}) {
  const signedChallenge = await signMobileAttendanceChallenge({
    session,
    deviceKeyId,
    purpose: 'VALIDATE',
  });

  return getCurrentMobileAttendanceTrustedDevice({
    accessToken: session.accessToken,
    tenantId: session.tenantId,
    payload: {
      staffIdentificationNumber: session.staffIdentificationNumber,
      deviceKeyId,
      challengeId: signedChallenge.challengeId,
      signature: signedChallenge.signature,
    },
  });
}

export function getMobileAttendanceDeviceMetadata(): MobileAttendanceDeviceMetadata {
  return {
    platform: Platform.OS,
    deviceName: getReadableDeviceName(),
    appVersion: Constants.expoConfig?.version,
  };
}

function getReadableDeviceName() {
  const deviceName = Constants.deviceName?.trim();
  const modelName = Constants.platform?.ios?.model?.trim();

  if (deviceName && modelName && deviceName !== modelName && !isGenericDeviceName(deviceName)) {
    return `${deviceName} (${modelName})`;
  }

  if (deviceName) {
    return deviceName;
  }

  if (modelName) {
    return modelName;
  }

  return Platform.select({ ios: 'iPhone', android: 'Android phone', default: 'Mobile device' });
}

function isGenericDeviceName(deviceName: string) {
  const normalized = deviceName.toLowerCase();
  return normalized === 'iphone' || normalized === 'ipad' || normalized === 'android';
}

function ensureBiometricsNativeModule() {
  if (NativeModules.ReactNativeBiometrics) {
    return;
  }

  throw new Error(
    'Biometric device signing is not available in this app build. Rebuild and reinstall the app so the native biometric module is included.'
  );
}

function generateUUID(): string {
  const randomUUID = globalThis.crypto?.randomUUID?.();

  if (randomUUID) {
    return randomUUID;
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
