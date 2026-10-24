'use client';

import { listTaskActivityInfiniteOptions } from '@flowboard/api-client/tanstack-query';
import { ActivityPageSchema } from '@flowboard/contracts';
import { ErrorState } from '@flowboard/ui';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { withQueryScope } from '../../lib/query-scope';

import { assembleActivity } from './activity-data';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { ResolvedStatus } from '@flowboard/contracts';

export function ActivityFeed({
  taskId,
  runtime,
  scope,
  statuses,
}: {
  runtime: ClientRuntime;
  scope: QueryScope;
  statuses: readonly ResolvedStatus[];
  taskId: string;
}) {
  const heading = useId();
  const [cycle, setCycle] = useState({ generation: 0, restarts: 0 });
  const query = useInfiniteQuery({
    ...withQueryScope(
      listTaskActivityInfiniteOptions({
        client: runtime.client,
        path: { taskId },
        query: { limit: '20' },
      }),
      scope,
      [`activity:${cycle.generation}`],
    ),
    initialPageParam: { path: { taskId }, query: {} },
    getNextPageParam: (page) => {
      const parsed = ActivityPageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : 3000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
  const error = query.isError ? apiError(query.error) : null;
  if (error?.code === 'INVALID_CURSOR' && cycle.restarts < 1) {
    setCycle({ generation: cycle.generation + 1, restarts: cycle.restarts + 1 });

    return null;
  }

  const result = assembleActivity({
    workspaceId: scope.workspaceId!,
    taskId,
    pages:
      query.data?.pages.map((response, index) => ({
        response,
        ...(typeof query.data.pageParams[index] === 'string'
          ? { cursor: query.data.pageParams[index] as string }
          : {}),
      })) ?? [],
  });
  const refresh = () =>
    setCycle((current) => ({ generation: current.generation + 1, restarts: 0 }));
  const label = (id: string) =>
    statuses.find((status) => status.id === id)?.name ?? `Status ${id.slice(0, 8)}`;

  return (
    <Stack component="section" aria-labelledby={heading} spacing={2}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
      >
        <Typography component="h3" variant="h3" id={heading}>
          Activity
        </Typography>
        <Button onClick={refresh} disabled={query.isFetching}>
          Refresh activity
        </Button>
      </Stack>
      {error || result.state === 'invalid' ? (
        <ErrorState
          title="Activity unavailable"
          description={error?.message ?? 'The activity response could not be verified.'}
          action={<Button onClick={refresh}>Retry activity</Button>}
        />
      ) : result.state === 'pending' ? (
        <Typography aria-live="polite">Loading activity…</Typography>
      ) : result.items.length === 0 ? (
        <Typography color="text.secondary">No status changes yet.</Typography>
      ) : (
        <>
          <Box component="ol" sx={{ m: 0, pl: 2.5, '& li + li': { mt: 2 } }}>
            {result.items.map((item) => (
              <Box component="li" key={item.id} sx={{ overflowWrap: 'anywhere' }}>
                <Typography>
                  {item.actor.name} changed status from{' '}
                  <strong>{label(item.payload.beforeStatusId)}</strong> to{' '}
                  <strong>{label(item.payload.afterStatusId)}</strong>.
                </Typography>
                <Typography
                  component="time"
                  dateTime={item.payload.occurredAt}
                  variant="caption"
                  color="text.secondary"
                >
                  {new Date(item.payload.occurredAt).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
          {query.hasNextPage && (
            <Button
              disabled={query.isFetching}
              onClick={() => {
                void query.fetchNextPage({ cancelRefetch: false });
              }}
            >
              Load older activity
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}
