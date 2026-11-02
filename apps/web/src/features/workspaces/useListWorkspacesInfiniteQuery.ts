'use client';

import { WorkspacePageSchema } from '@flowboard/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';

import {
  listWorkspacesInfiniteOptions,
  listWorkspacesInfiniteQueryKey,
} from '../../generated/apiHooks.gen';
import { withQueryScope } from '../../lib/queryScope';

import type { ApiRequestError } from '../../lib/apiError';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { ListWorkspacesResponse } from '@flowboard/api-client/types';
import type {
  InfiniteData,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';

type WorkspacesQueryKey = ReturnType<typeof listWorkspacesInfiniteQueryKey>;
type WorkspacesPageParam =
  string | Pick<WorkspacesQueryKey[0], 'body' | 'headers' | 'path' | 'query'>;
type WorkspacesData = InfiniteData<ListWorkspacesResponse, WorkspacesPageParam>;
export type ListWorkspacesQueryOptions = Omit<
  UseInfiniteQueryOptions<
    ListWorkspacesResponse,
    ApiRequestError,
    WorkspacesData,
    WorkspacesQueryKey,
    WorkspacesPageParam
  >,
  'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

export type ListWorkspacesQueryResult = UseInfiniteQueryResult<WorkspacesData, ApiRequestError>;

export function useListWorkspacesInfiniteQuery(
  {
    generation,
    runtime,
    scope,
  }: {
    generation: number;
    runtime: ClientRuntime;
    scope: QueryScope;
  },
  options: ListWorkspacesQueryOptions = {},
): ListWorkspacesQueryResult {
  const { queryKey, queryFn } = withQueryScope(
    listWorkspacesInfiniteOptions({ client: runtime.client, query: { limit: '50' } }),
    scope,
    [`memberships-attempt:${generation}`],
  );

  return useInfiniteQuery({
    ...options,
    queryKey,
    queryFn,
    initialPageParam: { query: {} },
    getNextPageParam: (page) => {
      const parsed = WorkspacePageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
  });
}
