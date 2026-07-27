import { useCallback } from 'react';

import { ApiError } from '@/lib/api/client';
import { refreshStaffToken } from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { StaffSession } from '@/lib/auth/types';

let pendingRefreshToken: string | null = null;
let pendingRefresh: Promise<StaffSession> | null = null;
let latestRefreshedSession: StaffSession | null = null;

function refreshSession(session: StaffSession) {
  if (!pendingRefresh || pendingRefreshToken !== session.refreshToken) {
    pendingRefreshToken = session.refreshToken;
    pendingRefresh = refreshStaffToken({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    })
      .then((refreshedSession) => {
        latestRefreshedSession = refreshedSession;
        return refreshedSession;
      })
      .finally(() => {
        pendingRefresh = null;
        pendingRefreshToken = null;
      });
  }

  return pendingRefresh;
}

export function useAuthenticatedRequest() {
  const { session, setSession } = useSession();

  return useCallback(
    async <T>(request: (activeSession: StaffSession) => Promise<T>) => {
      if (!session) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      try {
        return await request(session);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401 || !session.refreshToken) {
          throw error;
        }

        try {
          if (latestRefreshedSession && latestRefreshedSession.refreshToken !== session.refreshToken) {
            await setSession(latestRefreshedSession);
            return await request(latestRefreshedSession);
          }

          const refreshedSession = await refreshSession(session);
          await setSession(refreshedSession);
          return await request(refreshedSession);
        } catch (refreshError) {
          await setSession(null);
          throw refreshError;
        }
      }
    },
    [session, setSession]
  );
}
