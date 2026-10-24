'use client';

import { listWorkspacesInfiniteOptions } from '@flowboard/api-client/tanstack-query';
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
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { withQueryScope } from '../../lib/query-scope';
import { useSession } from '../../providers/app-providers';
import { SessionGate, SessionLoading } from '../auth/session-gate';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

function Memberships({ runtime, scope }: { runtime: ClientRuntime; scope: QueryScope }) {
  const router = useRouter();
  const { logout } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const query = useInfiniteQuery({
    ...withQueryScope(
      listWorkspacesInfiniteOptions({ client: runtime.client, query: { limit: '50' } }),
      scope,
      [`memberships-attempt:${attempt}`],
    ),
    initialPageParam: { query: {} },
    getNextPageParam: (page) => {
      const parsed = WorkspacePageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
  });
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
    <Box component="main" sx={{ maxWidth: 760, mx: 'auto', p: { xs: 4, md: 8 } }}>
      <Toolbar.Root style={{ marginBottom: 24 }}>
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
      {error && <ErrorState title="Workspace unavailable" description={error} />}
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
        <Stack spacing={3}>
          {items.map((workspace) => (
            <Surface.Root key={workspace.id}>
              <Button
                disabled={changing}
                fullWidth
                sx={{ justifyContent: 'space-between', p: 5 }}
                onClick={async () => {
                  setChanging(true);
                  setError(null);
                  try {
                    if (runtime.getSession()?.data.activeWorkspace?.id !== workspace.id)
                      await runtime.switchWorkspace(workspace.id);

                    router.push(`/w/${workspace.id}`);
                  } catch (cause) {
                    setError(apiError(cause).message);
                    setChanging(false);
                  }
                }}
              >
                {workspace.name} · {workspace.role}
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
