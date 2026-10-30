'use client';

import {
  listWorkspacesInfiniteOptions,
  listWorkspacesInfiniteQueryKey,
} from '@flowboard/api-client/tanstack-query';
import { WorkspacePageSchema } from '@flowboard/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/queryScope';

import type { ApiRequestError } from '../../lib/apiError';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { ListWorkspacesResponse } from '@flowboard/api-client/types';
import type {
  InfiniteData,
  QueryFunctionContext,
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

export async function fetchWorkspaces(
  client: ClientRuntime['client'],
  context: QueryFunctionContext<WorkspacesQueryKey, WorkspacesPageParam>,
): Promise<ListWorkspacesResponse> {
  const { queryFn } = listWorkspacesInfiniteOptions({ client, query: { limit: '50' } });
  if (typeof queryFn !== 'function') throw new Error('Workspace query is unavailable.');

  return queryFn(context);
}

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
  const { queryKey } = withQueryScope(
    listWorkspacesInfiniteOptions({ client: runtime.client, query: { limit: '50' } }),
    scope,
    [`memberships-attempt:${generation}`],
  );

  return useInfiniteQuery({
    ...options,
    queryKey,
    queryFn: (context) => fetchWorkspaces(runtime.client, context),
    initialPageParam: { query: {} },
    getNextPageParam: (page) => {
      const parsed = WorkspacePageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
  });
}
