'use client';

import { Button, Typography } from '@flowboard/ui';
import { ActivityPanel, ActivityTimeline, ErrorState } from '@flowboard/ui';
import { useState } from 'react';

import { apiError } from '../../lib/api-error';

import { assembleActivity } from './activity-data';
import { useListTaskActivityInfiniteQuery } from './use-list-task-activity-infinite-query';

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
  const query = useListTaskActivityInfiniteQuery({
    generation: cycle.generation,
    runtime,
    scope,
    taskId,
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
