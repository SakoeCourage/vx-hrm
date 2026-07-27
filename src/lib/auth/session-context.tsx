import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { clearStoredSession, getStoredSession, saveSession } from '@/lib/auth/session-store';
import { StaffSession } from '@/lib/auth/types';

type SessionContextValue = {
  session: StaffSession | null;
  isSessionLoading: boolean;
  setSession: (session: StaffSession | null) => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [sessionState, setSessionState] = useState<StaffSession | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getStoredSession()
      .then((storedSession) => {
        if (isMounted) {
          setSessionState(storedSession);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsSessionLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setSession = useCallback(async (session: StaffSession | null) => {
    setSessionState(session);

    if (session) {
      await saveSession(session);
      return;
    }

    await clearStoredSession();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session: sessionState,
      isSessionLoading,
      setSession,
    }),
    [isSessionLoading, sessionState, setSession]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside SessionProvider');
  }

  return context;
}
