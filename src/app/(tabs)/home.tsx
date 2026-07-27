import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect } from 'expo-router';

import { HomeShell } from '@/features/home/home-shell';
import { getAuthStaff } from '@/lib/auth/api';
import { useSession } from '@/lib/auth/session-context';
import { useAuthenticatedRequest } from '@/lib/auth/use-authenticated-request';

export default function HomeTab() {
  const { session, setSession } = useSession();
  const authenticatedRequest = useAuthenticatedRequest();
  const queryClient = useQueryClient();

  const authStaffQuery = useQuery({
    queryKey: ['auth-staff', session?.id],
    queryFn: () =>
      authenticatedRequest((activeSession) =>
        getAuthStaff(activeSession.accessToken, activeSession.tenantId)
      ),
    enabled: Boolean(session?.accessToken && session?.tenantId),
  });

  if (!session) {
    return <Redirect href="/" />;
  }

  const handleSignOut = async () => {
    queryClient.setQueryData(['session-bootstrap'], null);
    queryClient.removeQueries({ queryKey: ['auth-staff'] });
    await setSession(null);
  };

  return <HomeShell staff={authStaffQuery.data ?? session} onSignOut={handleSignOut} />;
}
