'use client';

import { WorkspacePageSchema } from '@flowboard/contracts';
import {
  Box,
  Button,
  EmptyState,
  ErrorState,
  Stack,
  Surface,
  Toolbar,
  Typography,
} from '@flowboard/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { useSession } from '../../providers/app-providers';
import { SessionGate, SessionLoading } from '../auth/session-gate';
import { useNotifications } from '../notifications/notification-provider';

import { useListWorkspacesInfiniteQuery } from './use-list-workspaces-infinite-query';
import { useWorkspaceWrite } from './use-workspace-write';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

function Memberships({ runtime, scope }: { runtime: ClientRuntime; scope: QueryScope }) {
  const router = useRouter();
  const notifications = useNotifications();
  const { logout, switchWorkspace } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { submit } = useWorkspaceWrite(runtime, scope);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;

    return () => {
      alive.current = false;
    };
  }, []);

  const query = useListWorkspacesInfiniteQuery({ generation: attempt, runtime, scope });

  const pages = WorkspacePageSchema.array().safeParse(query.data?.pages ?? []);
  const cursors = pages.success ? pages.data.flatMap((page) => page.pageInfo.nextCursor ?? []) : [];
  const repeated = new Set(cursors).size !== cursors.length;
  const items = pages.success ? pages.data.flatMap((page) => page.items) : [];
  const invalid =
    !pages.success ||
    repeated ||
    new Set(items.map((item) => item.id)).size !== items.length ||
    (query.hasNextPage && (query.data?.pages.length ?? 0) >= 100);
  const { hasNextPage, isFetching, isError, fetchNextPage } = query;

  useEffect(() => {
    if (hasNextPage && !isFetching && !isError && !invalid) void fetchNextPage();
  }, [hasNextPage, isFetching, isError, invalid, fetchNextPage]);

  return (
    <Box component="main" sx={{ maxWidth: '76rem', mx: 'auto', p: { xs: 1.6, md: 3.2 } }}>
      <Toolbar.Root style={{ marginBottom: '2.4rem' }}>
        <Typography component="h1" variant="h1">
          Choose a workspace
        </Typography>
        <Button
          onClick={() => {
            void logout();
          }}
        >
          Sign out
        </Button>
      </Toolbar.Root>
      {error && (
        <ErrorState
          title="Workspace unavailable"
          description={error}
          action={
            <Button
              onClick={() => {
                setError(null);
                setAttempt((value) => value + 1);
              }}
            >
              Reload workspaces
            </Button>
          }
        />
      )}
      {query.isPending || (query.hasNextPage && !query.isError && !invalid) ? (
        <SessionLoading />
      ) : query.isError || invalid ? (
        <ErrorState
          title="Unable to load workspaces"
          description={
            query.isError
              ? apiError(query.error).message
              : 'The workspace response changed. Reload to continue.'
          }
          action={<Button onClick={() => setAttempt((current) => current + 1)}>Retry</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          description="Ask a workspace administrator to add your account or send an invitation."
          title="No workspace memberships"
        />
      ) : (
        <Stack spacing={1.2}>
          {items.map((workspace) => (
            <Surface.Root key={workspace.id}>
              <Button
                disabled={changing}
                fullWidth
                sx={{ justifyContent: 'space-between', p: 2 }}
                onClick={async () => {
                  setChanging(true);
                  setError(null);
                  try {
                    if (workspace.archivedAt) {
                      const result = await submit({
                        kind: 'restore',
                        workspaceId: workspace.id,
                        expectedConfigVersion: workspace.configVersion,
                      });
                      if (!result.success) {
                        if (alive.current) {
                          setError(result.error.message);
                          setChanging(false);
                        }

                        return;
                      }

                      await runtime.refresh();
                    }

                    if (runtime.getSession()?.data.activeWorkspace?.archivedAt)
                      await runtime.refresh();

                    if (runtime.getSession()?.data.user.id !== scope.userId) return;

                    if (runtime.getSession()?.data.activeWorkspace?.id !== workspace.id)
                      await switchWorkspace(workspace.id);

                    if (workspace.archivedAt) notifications.show('Workspace restored.', 'success');

                    router.push(`/w/${workspace.id}`);
                  } catch (cause) {
                    const failure = apiError(cause);
                    if (alive.current) {
                      setError(failure.message);
                      setChanging(false);
                    }
                  }
                }}
              >
                {workspace.archivedAt
                  ? `Restore ${workspace.name}`
                  : `${workspace.name} · ${workspace.role}`}
              </Button>
            </Surface.Root>
          ))}
        </Stack>
      )}
    </Box>
  );
}

export function WorkspacePicker() {
  const { runtime, scope } = useSession();

  return (
    <SessionGate>
      {runtime && scope && (
        <Memberships key={JSON.stringify(scope)} runtime={runtime} scope={scope} />
      )}
    </SessionGate>
  );
}
