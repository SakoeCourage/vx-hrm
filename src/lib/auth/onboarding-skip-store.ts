import * as SecureStore from 'expo-secure-store';

const ONBOARDING_SKIP_PREFIX = 'vx_hrm_onboarding_skip_until';
const ONBOARDING_SKIP_DAYS = 7;
const ONBOARDING_SKIP_MS = ONBOARDING_SKIP_DAYS * 24 * 60 * 60 * 1000;

type OnboardingSkipIdentity = {
  tenantId?: string;
  staffId?: string;
};

function getOnboardingSkipKey({ tenantId, staffId }: OnboardingSkipIdentity) {
  const safeTenantId = sanitizeKeyPart(tenantId ?? 'tenant');
  const safeStaffId = sanitizeKeyPart(staffId ?? 'staff');
  return `${ONBOARDING_SKIP_PREFIX}_${safeTenantId}_${safeStaffId}`;
}

function sanitizeKeyPart(value: string) {
  const sanitized = value.replace(/[^A-Za-z0-9._-]/g, '_');
  return sanitized || 'unknown';
}

export async function markOnboardingSkipped(identity: OnboardingSkipIdentity) {
  const skipUntil = Date.now() + ONBOARDING_SKIP_MS;
  await SecureStore.setItemAsync(getOnboardingSkipKey(identity), String(skipUntil));
}

export async function hasActiveOnboardingSkip(identity: OnboardingSkipIdentity) {
  const value = await SecureStore.getItemAsync(getOnboardingSkipKey(identity));
  const skipUntil = Number(value);

  if (!Number.isFinite(skipUntil)) {
    return false;
  }

  if (Date.now() > skipUntil) {
    await SecureStore.deleteItemAsync(getOnboardingSkipKey(identity));
    return false;
  }

  return true;
}
