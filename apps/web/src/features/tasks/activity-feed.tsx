'use client';

import { listTaskActivityInfiniteOptions } from '@flowboard/api-client/tanstack-query';
import { ActivityPageSchema } from '@flowboard/contracts';
import { Button, Typography } from '@flowboard/ui';
import { ActivityPanel, ActivityTimeline, ErrorState } from '@flowboard/ui';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';

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

  return (
    <ActivityPanel
      actions={
        <Button onClick={refresh} disabled={query.isFetching}>
          Refresh activity
        </Button>
      }
    >
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
          <ActivityTimeline items={result.items} statuses={statuses} />
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
    </ActivityPanel>
  );
}
