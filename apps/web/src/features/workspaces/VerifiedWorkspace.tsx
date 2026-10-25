'use client';

import { CurrentUserEnvelopeSchema } from '@flowboard/contracts';
import { Alert, Button, ErrorState, FlowboardLogo, WorkspaceLayout } from '@flowboard/ui';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { apiError } from '../../lib/apiError';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import { useSession } from '../../providers/useSession';
import { SessionLoading } from '../auth/SessionLoading';
import { useGetCurrentUserQuery } from '../auth/useGetCurrentUserQuery';
import { ConfigurationSettingsHost } from '../config/ConfigurationSettingsHost';
import { TaskEditorProvider } from '../tasks/TaskEditorProvider';
import { WorkspaceActions } from './WorkspaceActions';
import { WorkspaceNavigation } from './WorkspaceNavigation';

export function VerifiedWorkspace({
  runtime,
  scope,
  listId,
  children,
}: {
  children: ReactNode;
  listId?: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const { logout } = useSession();
  const [open, setOpen] = useState(false);
  const query = useGetCurrentUserQuery({ runtime, scope });

  if (query.isPending) return <SessionLoading />;

  const refreshError = query.isError ? apiError(query.error) : null;
  const canRetainWorkspace =
    refreshError &&
    query.data &&
    ['INTERNAL_ERROR', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR'].includes(refreshError.code);
  if (query.isError && !canRetainWorkspace)
    return (
      <ErrorState
        title="Workspace unavailable"
        description={apiError(query.error).message}
        action={
          <Button
            onClick={() => {
              void query.refetch();
            }}
          >
            Retry
          </Button>
        }
      />
    );

  const parsed = CurrentUserEnvelopeSchema.safeParse(query.data);
  if (
    !parsed.success ||
    parsed.data.data.user.id !== scope.userId ||
    parsed.data.data.activeWorkspace?.id !== scope.workspaceId
  )
    return (
      <ErrorState
        title="Workspace changed"
        description="Choose your workspace again to continue."
        action={
          <Button component={NextLink} href="/workspaces">
            Choose workspace
          </Button>
        }
      />
    );

  const { user, activeWorkspace } = parsed.data.data;
  if (activeWorkspace.archivedAt)
    return (
      <ErrorState
        title="Workspace archived"
        description="Choose a workspace to continue, or restore it if you are an administrator."
        action={
          <Button component={NextLink} href="/workspaces">
            Choose workspace
          </Button>
        }
      />
    );

  return (
    <TaskEditorProvider listId={listId} runtime={runtime} scope={scope}>
      {canRetainWorkspace && (
        <Alert
          severity="warning"
          action={
            <Button
              onClick={() => {
                void query.refetch();
              }}
            >
              Retry workspace refresh
            </Button>
          }
        >
          Workspace details could not refresh. Your draft is kept.
        </Alert>
      )}
      <WorkspaceLayout
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => setOpen(false)}
        header={<FlowboardLogo />}
        headerActions={
          <WorkspaceActions
            listId={listId}
            runtime={runtime}
            scope={scope}
            role={activeWorkspace.role}
          />
        }
        navigation={
          <WorkspaceNavigation
            runtime={runtime}
            scope={scope}
            selectedId={listId}
            workspace={activeWorkspace}
            userName={user.name}
            onSelect={() => setOpen(false)}
            onLogout={() => {
              void logout();
            }}
          />
        }
      >
        <ConfigurationSettingsHost>{children}</ConfigurationSettingsHost>
      </WorkspaceLayout>
    </TaskEditorProvider>
  );
}
