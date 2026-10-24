'use client';

import { listTaskActivityInfiniteOptions } from '@flowboard/api-client/tanstack-query';
import { ActivityPageSchema } from '@flowboard/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/query-scope';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

export function useListTaskActivityInfiniteQuery({
  generation,
  runtime,
  scope,
  taskId,
}: {
  generation: number;
  runtime: ClientRuntime;
  scope: QueryScope;
  taskId: string;
}) {
  return useInfiniteQuery({
    ...withQueryScope(
      listTaskActivityInfiniteOptions({
        client: runtime.client,
        path: { taskId },
        query: { limit: '20' },
      }),
      scope,
      [`activity:${generation}`],
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
}
