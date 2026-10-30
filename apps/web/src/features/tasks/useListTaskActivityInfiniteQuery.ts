'use client';

import {
  listTaskActivityInfiniteOptions,
  listTaskActivityInfiniteQueryKey,
} from '@flowboard/api-client/tanstack-query';
import { ActivityPageSchema } from '@flowboard/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/queryScope';

import type { ApiRequestError } from '../../lib/apiError';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { ListTaskActivityResponse } from '@flowboard/api-client/types';
import type {
  InfiniteData,
  QueryFunctionContext,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';

type ActivityQueryKey = ReturnType<typeof listTaskActivityInfiniteQueryKey>;
type ActivityPageParam = string | Pick<ActivityQueryKey[0], 'body' | 'headers' | 'path' | 'query'>;
type ActivityData = InfiniteData<ListTaskActivityResponse, ActivityPageParam>;
export type ListTaskActivityQueryOptions = Omit<
  UseInfiniteQueryOptions<
    ListTaskActivityResponse,
    ApiRequestError,
    ActivityData,
    ActivityQueryKey,
    ActivityPageParam
  >,
  'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

export type ListTaskActivityQueryResult = UseInfiniteQueryResult<ActivityData, ApiRequestError>;

export async function fetchTaskActivity(
  client: ClientRuntime['client'],
  taskId: string,
  context: QueryFunctionContext<ActivityQueryKey, ActivityPageParam>,
): Promise<ListTaskActivityResponse> {
  const { queryFn } = listTaskActivityInfiniteOptions({
    client,
    path: { taskId },
    query: { limit: '20' },
  });
  if (typeof queryFn !== 'function') throw new Error('Activity query is unavailable.');

  return queryFn(context);
}

export function useListTaskActivityInfiniteQuery(
  {
    generation,
    runtime,
    scope,
    taskId,
  }: {
    generation: number;
    runtime: ClientRuntime;
    scope: QueryScope;
    taskId: string;
  },
  options: ListTaskActivityQueryOptions = {},
): ListTaskActivityQueryResult {
  const { queryKey } = withQueryScope(
    listTaskActivityInfiniteOptions({
      client: runtime.client,
      path: { taskId },
      query: { limit: '20' },
    }),
    scope,
    [`activity:${generation}`],
  );

  return useInfiniteQuery({
    retry: false,
    refetchInterval: (query) => (query.state.error ? false : 3000),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    ...options,
    queryKey,
    queryFn: (context) => fetchTaskActivity(runtime.client, taskId, context),
    initialPageParam: { path: { taskId }, query: {} },
    getNextPageParam: (page) => {
      const parsed = ActivityPageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
  });
}
