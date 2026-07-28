import * as SecureStore from 'expo-secure-store';

const LOCAL_FACE_ENROLLMENT_KEY_PREFIX = 'vx_hrm_local_face_enrollment';
const SECURE_STORE_KEY_UNSAFE_CHARS = /[^A-Za-z0-9._-]/g;

export type LocalFaceEnrollmentRecord = {
  embedding?: number[];
  embeddingModel?: string;
  enrolledAt: string;
  hasRecognitionTemplate?: boolean;
  recognitionMode?: 'prototype-face-presence' | 'embedding';
  staffIdentity: string;
  templateVersion: number;
};

export function hasUsableLocalFaceRecognitionTemplate(
  enrollment: LocalFaceEnrollmentRecord | null
) {
  return Boolean(enrollment?.embedding?.length && enrollment.recognitionMode === 'embedding');
}

export function isPrototypeLocalFaceEnrollment(enrollment: LocalFaceEnrollmentRecord | null) {
  return enrollment?.recognitionMode !== 'embedding';
}

export function getLocalFaceEnrollmentKey(staffIdentity: string) {
  return `${LOCAL_FACE_ENROLLMENT_KEY_PREFIX}.${staffIdentity.replace(SECURE_STORE_KEY_UNSAFE_CHARS, '_')}`;
}

export async function getLocalFaceEnrollment(staffIdentity: string) {
  const value = await SecureStore.getItemAsync(getLocalFaceEnrollmentKey(staffIdentity));

  if (!value) {
    return null;
  }

  return JSON.parse(value) as LocalFaceEnrollmentRecord;
}

export async function saveLocalFaceEnrollment(record: LocalFaceEnrollmentRecord) {
  await SecureStore.setItemAsync(
    getLocalFaceEnrollmentKey(record.staffIdentity),
    JSON.stringify(record)
  );
}

export async function clearLocalFaceEnrollment(staffIdentity: string) {
  await SecureStore.deleteItemAsync(getLocalFaceEnrollmentKey(staffIdentity));
}

export function getLocalFaceStaffIdentity({
  staffIdentificationNumber,
  tenantId,
}: {
  staffIdentificationNumber?: string | null;
  tenantId?: string | null;
}) {
  if (!tenantId || !staffIdentificationNumber) {
    return null;
  }

  return `${tenantId}:${staffIdentificationNumber}`;
}
