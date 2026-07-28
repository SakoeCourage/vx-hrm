const FACE_VERIFICATION_SESSION_TTL_MS = 10 * 60 * 1000;

let verifiedAt: number | null = null;
let verifiedIdentity: string | null = null;

export function markLocalFaceVerificationSession(identity: string) {
  verifiedAt = Date.now();
  verifiedIdentity = identity;
}

export function hasValidLocalFaceVerificationSession(identity?: string | null) {
  if (!identity || !verifiedAt || verifiedIdentity !== identity) {
    return false;
  }

  const isFresh = Date.now() - verifiedAt <= FACE_VERIFICATION_SESSION_TTL_MS;
  if (!isFresh) {
    verifiedAt = null;
  }

  return isFresh;
}

export function clearLocalFaceVerificationSession() {
  verifiedAt = null;
  verifiedIdentity = null;
}
