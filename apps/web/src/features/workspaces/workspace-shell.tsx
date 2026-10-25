'use client';

import { CurrentUserEnvelopeSchema, NodeEnvelopeSchema } from '@flowboard/contracts';
import { Alert, Box, Button, FlowboardLogo, Stack, Typography } from '@flowboard/ui';
import { ErrorState, WorkspaceLayout } from '@flowboard/ui';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { useSession } from '../../providers/app-providers';
import { SessionGate, SessionLoading } from '../auth/session-gate';
import { useGetCurrentUserQuery } from '../auth/use-get-current-user-query';
import { ConfigurationSettingsHost } from '../config/configuration-settings-host';
import { ListViews } from '../list/list-view';
import { TaskEditorProvider } from '../tasks/task-drawer';
import { useGetNodeQuery } from '../tree/use-get-node-query';

import { WorkspaceActions } from './workspace-actions';
import { WorkspaceNavigation } from './workspace-navigation';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { ReactNode } from 'react';

function SelectedList({
  listId,
  runtime,
  scope,
}: {
  listId: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const query = useGetNodeQuery({ nodeId: listId, runtime, scope });

  if (query.isPending) return <SessionLoading />;

  if (query.isError) {
    const error = apiError(query.error);

    return (
      <ErrorState
        title={error.code === 'FORBIDDEN' ? 'Access denied' : 'List unavailable'}
        description={error.message}
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
  }

  const parsed = NodeEnvelopeSchema.safeParse(query.data);
  if (
    !parsed.success ||
    parsed.data.data.id !== listId ||
    parsed.data.data.type !== 'list' ||
    parsed.data.data.workspaceId !== scope.workspaceId ||
    parsed.data.data.archivedAt !== null
  )
    return (
      <ErrorState
        description="This address does not identify an available list in this workspace."
        title="List unavailable"
      />
    );

  const list = parsed.data.data;

  return (
    <Stack spacing={1.6}>
      <Typography component="h1" variant="h1" sx={{ overflowWrap: 'anywhere' }}>
        {list.name}
      </Typography>
      <Typography color="text.secondary">
        {list.visibility === 'private' ? 'Private list' : 'Workspace list'}
      </Typography>
      <ListViews listId={listId} />
    </Stack>
  );
}

export function ListDetails({ listId }: { listId: string }) {
  const { runtime, scope } = useSession();

  return runtime && scope ? (
    <SelectedList key={listId} listId={listId} runtime={runtime} scope={scope} />
  ) : (
    <SessionLoading />
  );
}

function VerifiedWorkspace({
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

export function WorkspaceShell({
  workspaceId,
  children,
}: {
  children: ReactNode;
  workspaceId: string;
}) {
  const { listId } = useParams<{ listId?: string }>();
  const { runtime, scope, status, switchWorkspace, session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const target = useRef(workspaceId);

  useEffect(() => {
    target.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    if (!runtime || !scope || status !== 'authenticated' || scope.workspaceId === workspaceId)
      return;

    const key = `${scope.userId}:${workspaceId}`;
    if (pending.current === key) return;

    pending.current = key;
    void switchWorkspace(workspaceId).catch((cause: unknown) => {
      if (target.current === workspaceId) {
        const failure = apiError(cause);
        setError(failure.message);
      }
    });
  }, [runtime, scope, status, switchWorkspace, workspaceId]);

  if (error)
    return (
      <Box component="main" sx={{ p: 2.4 }}>
        <ErrorState
          title="Workspace unavailable"
          description={error}
          action={
            <Button component={NextLink} href="/workspaces">
              Choose workspace
            </Button>
          }
        />
      </Box>
    );

  return (
    <SessionGate>
      {session?.data.activeWorkspace?.archivedAt && scope?.workspaceId === workspaceId ? (
        <ErrorState
          title="Workspace archived"
          description="This workspace is archived. Choose a workspace to restore it or continue elsewhere."
          action={
            <Button component={NextLink} href="/workspaces">
              Choose workspace
            </Button>
          }
        />
      ) : runtime && scope?.workspaceId === workspaceId ? (
        <VerifiedWorkspace
          key={JSON.stringify(scope)}
          runtime={runtime}
          scope={scope}
          listId={listId}
        >
          {children}
        </VerifiedWorkspace>
      ) : (
        <SessionLoading />
      )}
    </SessionGate>
  );
}
