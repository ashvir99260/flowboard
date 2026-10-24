'use client';

import { setupClient } from '@flowboard/api-client/session';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import { RealtimeProvider } from '../features/realtime/realtime-provider';
import { apiError } from '../lib/api-error';

import type { QueryScope } from '../lib/query-scope';
import type { SessionEnvelope } from '@flowboard/contracts';
import type { ReactNode } from 'react';

export type ClientRuntime = ReturnType<typeof setupClient>;

type SessionState = {
  revision: number;
  session: SessionEnvelope | null;
  status: 'booting' | 'changing' | 'authenticated' | 'anonymous';
};
interface SessionContextValue extends SessionState {
  logout: () => Promise<void>;
  runtime: ClientRuntime | null;
  scope: QueryScope | null;
}
const SessionContext = createContext<SessionContextValue | null>(null);

export function AppProviders({
  children,
  realtimeUrl,
}: Readonly<{ children: ReactNode; realtimeUrl: string | null }>) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 15000 } } }),
  );
  const [runtime, setRuntime] = useState<ClientRuntime | null>(null);
  const [state, setState] = useState<SessionState>({
    revision: 0,
    session: null,
    status: 'booting',
  });
  const [notice, setNotice] = useState<{ message: string; retryLogout: boolean } | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    let active = true;
    let booting = true;
    let authenticated = false;
    const instance = setupClient({
      onSessionChange(session, reason) {
        if (!active) return;

        if (reason !== 'refresh') {
          revision.current++;
          void queryClient.cancelQueries();
          queryClient.clear();
        }

        if (!booting && authenticated && (reason === 'external' || reason === 'expired'))
          setNotice({
            message: 'Your session changed or expired. Sign in again.',
            retryLogout: false,
          });

        if (session && (reason === 'login' || reason === 'switch')) setNotice(null);

        authenticated = Boolean(session);

        setState({
          revision: revision.current,
          session,
          status: session
            ? 'authenticated'
            : reason === 'login' || reason === 'switch'
              ? 'changing'
              : 'anonymous',
        });
      },
    });
    setRuntime(instance);
    void instance
      .refresh()
      .catch((error: unknown) => {
        if (!active) return;

        if (apiError(error).code === 'COORDINATION_UNAVAILABLE')
          setNotice({ message: apiError(error).message, retryLogout: false });

        setState({ revision: revision.current, session: null, status: 'anonymous' });
      })
      .finally(() => {
        booting = false;
      });

    return () => {
      active = false;
      instance.dispose();
      void queryClient.cancelQueries();
      queryClient.clear();
    };
  }, [queryClient]);

  const logout = async () => {
    if (!runtime) return;

    setNotice(null);
    const request = runtime.logout();
    const expectedRevision = revision.current;
    try {
      await request;
    } catch {
      if (revision.current === expectedRevision)
        setNotice({
          message: 'Sign out could not reach the server. Retry to clear the server session.',
          retryLogout: true,
        });
    }
  };
  const scope = state.session
    ? {
        revision: state.revision,
        userId: state.session.data.user.id,
        workspaceId: state.session.data.activeWorkspace?.id ?? null,
      }
    : null;

  return (
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={{ ...state, runtime, scope, logout }}>
        {notice && (
          <Alert
            severity="warning"
            action={
              notice.retryLogout ? (
                <Button
                  onClick={() => {
                    void logout();
                  }}
                >
                  Retry sign out
                </Button>
              ) : undefined
            }
          >
            {notice.message}
          </Alert>
        )}
        <RealtimeProvider runtime={runtime} session={state.session} url={realtimeUrl}>
          {children}
        </RealtimeProvider>
      </SessionContext.Provider>
    </QueryClientProvider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Session components require AppProviders');

  return value;
}
