'use client';

import { setupClient } from '@flowboard/api-client/session';
import { Alert, Button } from '@flowboard/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

import {
  NotificationProvider,
  useNotifications,
} from '../features/notifications/notification-provider';
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
  login: ClientRuntime['login'];
  logout: () => Promise<void>;
  runtime: ClientRuntime | null;
  scope: QueryScope | null;
  signup: ClientRuntime['signup'];
  switchWorkspace: ClientRuntime['switchWorkspace'];
}
const SessionContext = createContext<SessionContextValue | null>(null);

function RuntimeProviders({
  children,
  realtimeUrl,
}: Readonly<{ children: ReactNode; realtimeUrl: string | null }>) {
  const notifications = useNotifications();
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
  const lastChange = useRef('initial');

  useEffect(() => {
    let active = true;
    let booting = true;
    let authenticated = false;
    const instance = setupClient({
      onSessionChange(session, reason) {
        if (!active) return;

        if (reason !== 'refresh') {
          lastChange.current = reason;
          notifications.clear();
          revision.current++;
          void queryClient.cancelQueries();
          queryClient.clear();
        }

        if (!booting && authenticated && (reason === 'external' || reason === 'expired'))
          setNotice({
            message: 'Your session changed or expired. Sign in again.',
            retryLogout: false,
          });

        if (session && (reason === 'login' || reason === 'switch')) {
          setNotice(null);
          notifications.show(reason === 'login' ? 'Signed in.' : 'Workspace switched.', 'success');
        }

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
  }, [notifications, queryClient]);

  const sessionAction = async <T,>(action: () => Promise<T>): Promise<T> => {
    const request = action();
    const started = revision.current;
    try {
      return await request;
    } catch (cause) {
      const ownExpiry = revision.current === started + 1 && lastChange.current === 'expired';
      if (revision.current === started || ownExpiry)
        notifications.show(apiError(cause).message, 'error');

      throw cause;
    }
  };

  const logout = async () => {
    if (!runtime) return;

    setNotice(null);
    const request = runtime.logout();
    const expectedRevision = revision.current;
    const report = notifications.capture();
    try {
      await request;
      report('Signed out.', 'success');
    } catch {
      if (revision.current === expectedRevision) {
        report('Sign out could not reach the server. Retry to clear the server session.', 'error');
        setNotice({
          message: 'Sign out could not reach the server. Retry to clear the server session.',
          retryLogout: true,
        });
      }
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
      <SessionContext.Provider
        value={{
          ...state,
          runtime,
          scope,
          logout,
          login: (body) => sessionAction(() => runtime!.login(body)),
          signup: (body) => sessionAction(() => runtime!.signup(body)),
          switchWorkspace: (id) => sessionAction(() => runtime!.switchWorkspace(id)),
        }}
      >
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

export function AppProviders(props: Readonly<{ children: ReactNode; realtimeUrl: string | null }>) {
  return (
    <NotificationProvider>
      <RuntimeProviders {...props} />
    </NotificationProvider>
  );
}
