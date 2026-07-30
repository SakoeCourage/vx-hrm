import * as SecureStore from 'expo-secure-store';

import { AuthStaff, StaffSession } from '@/lib/auth/types';

const SESSION_KEY = 'vx_hrm_staff_session';
const SESSION_PROFILE_KEY = 'vx_hrm_staff_session_profile';
const SESSION_ACCESS_TOKEN_KEY = 'vx_hrm_staff_session_access_token';
const SESSION_REFRESH_TOKEN_KEY = 'vx_hrm_staff_session_refresh_token';

export async function saveSession(session: StaffSession) {
  const { accessToken, refreshToken, ...profile } = session;

  await Promise.all([
    SecureStore.setItemAsync(SESSION_PROFILE_KEY, JSON.stringify(profile)),
    SecureStore.setItemAsync(SESSION_ACCESS_TOKEN_KEY, accessToken),
    SecureStore.setItemAsync(SESSION_REFRESH_TOKEN_KEY, refreshToken),
    SecureStore.deleteItemAsync(SESSION_KEY),
  ]);
}

export async function getStoredSession() {
  const [profileValue, accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(SESSION_PROFILE_KEY),
    SecureStore.getItemAsync(SESSION_ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(SESSION_REFRESH_TOKEN_KEY),
  ]);

  if (profileValue && accessToken && refreshToken) {
    return {
      ...JSON.parse(profileValue),
      accessToken,
      refreshToken,
    } as StaffSession;
  }

  const value = await SecureStore.getItemAsync(SESSION_KEY);

  if (!value) {
    return null;
  }

  const session = JSON.parse(value) as StaffSession;
  await saveSession(session);
  return session;
}

export async function getRememberedStaffProfile() {
  const profileValue = await SecureStore.getItemAsync(SESSION_PROFILE_KEY);

  if (!profileValue) {
    return null;
  }

  return JSON.parse(profileValue) as AuthStaff;
}

export async function clearStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(SESSION_KEY),
    SecureStore.deleteItemAsync(SESSION_ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(SESSION_REFRESH_TOKEN_KEY),
  ]);
}
