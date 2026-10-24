'use client';

import { getCurrentUserOptions, getNodeOptions } from '@flowboard/api-client/tanstack-query';
import { CurrentUserEnvelopeSchema, NodeEnvelopeSchema } from '@flowboard/contracts';
import { ErrorState } from '@flowboard/ui';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useQuery } from '@tanstack/react-query';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { withQueryScope } from '../../lib/query-scope';
import { useSession } from '../../providers/app-providers';
import { SessionGate, SessionLoading } from '../auth/session-gate';
import { StatusSettingsHost } from '../config/statuses/status-settings-host';
import { ListViews } from '../list/list-view';
import { TaskEditorProvider } from '../tasks/task-drawer';
import { Sidebar } from '../tree/sidebar';

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
  const query = useQuery(
    withQueryScope(getNodeOptions({ client: runtime.client, path: { nodeId: listId } }), scope),
  );
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
    <Stack spacing={4}>
      <Typography component="h1" variant="h1" sx={{ overflowWrap: 'anywhere' }}>
        {list.name}
      </Typography>
      <Typography color="text.secondary">
        {list.visibility === 'private' ? 'Private list' : 'Workspace list'}
      </Typography>
      <Box component="dl" sx={{ m: 0 }}>
        <Typography component="dt">Created</Typography>
        <Typography component="dd" sx={{ m: 0, mb: 3 }}>
          {new Date(list.createdAt).toLocaleDateString()}
        </Typography>
        <Typography component="dt">Last updated</Typography>
        <Typography component="dd" sx={{ m: 0 }}>
          {new Date(list.updatedAt).toLocaleDateString()}
        </Typography>
      </Box>
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
  const desktop = useMediaQuery((theme) => theme.breakpoints.up('md'));
  const query = useQuery(withQueryScope(getCurrentUserOptions({ client: runtime.client }), scope));
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
      <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
        <Drawer
          open={desktop || open}
          variant={desktop ? 'permanent' : 'temporary'}
          onClose={() => setOpen(false)}
          sx={{
            width: desktop ? 272 : 0,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 272,
              maxWidth: 'calc(100vw - 32px)',
              boxSizing: 'border-box',
            },
          }}
        >
          <Box
            component="nav"
            aria-label="Workspace navigation"
            sx={{ p: 3, display: 'flex', flexDirection: 'column', minHeight: '100%' }}
          >
            {!desktop && <Button onClick={() => setOpen(false)}>Close navigation</Button>}
            <Typography variant="h3" component="h2" sx={{ p: 2, overflowWrap: 'anywhere' }}>
              {activeWorkspace.name}
            </Typography>
            <Button component={NextLink} href="/workspaces">
              Switch workspace
            </Button>
            {activeWorkspace.role === 'admin' && (
              <Button
                component={NextLink}
                href={`/w/${scope.workspaceId}/settings/statuses`}
                onClick={() => setOpen(false)}
              >
                Status settings
              </Button>
            )}
            <Divider sx={{ my: 3 }} />
            <Sidebar
              runtime={runtime}
              scope={scope}
              selectedId={listId}
              onSelect={() => setOpen(false)}
            />
            <Box sx={{ mt: 'auto', pt: 6 }}>
              <Typography variant="body2" sx={{ px: 2, overflowWrap: 'anywhere' }}>
                {user.name}
              </Typography>
              <Button
                onClick={() => {
                  void logout();
                }}
              >
                Sign out
              </Button>
            </Box>
          </Box>
        </Drawer>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {!desktop && (
            <Box sx={{ p: 3 }}>
              <Button onClick={() => setOpen(true)}>Open navigation</Button>
            </Box>
          )}
          <Box component="main" sx={{ p: { xs: 4, md: 8 } }}>
            <StatusSettingsHost>{children}</StatusSettingsHost>
          </Box>
        </Box>
      </Box>
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
  const { runtime, scope, status } = useSession();
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
    void runtime.switchWorkspace(workspaceId).catch((cause: unknown) => {
      if (target.current === workspaceId) setError(apiError(cause).message);
    });
  }, [runtime, scope, status, workspaceId]);

  if (error)
    return (
      <Box component="main" sx={{ p: 6 }}>
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
      {runtime && scope?.workspaceId === workspaceId ? (
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
