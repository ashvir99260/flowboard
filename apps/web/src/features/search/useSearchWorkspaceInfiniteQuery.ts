'use client';

import {
  searchWorkspaceInfiniteOptions,
  searchWorkspaceInfiniteQueryKey,
} from '@flowboard/api-client/tanstack-query';
import { SearchPageSchema } from '@flowboard/contracts';
import {
  focusManager,
  onlineManager,
  useInfiniteQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { withQueryScope } from '../../lib/queryScope';
import { configurationChanged } from '../config/configurationEvents';
import { useRealtime } from '../realtime/useRealtime';

import type { ApiRequestError } from '../../lib/apiError';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { SearchWorkspaceResponse } from '@flowboard/api-client/types';
import type {
  InfiniteData,
  QueryFunctionContext,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';

type SearchQueryKey = ReturnType<typeof searchWorkspaceInfiniteQueryKey>;
type SearchPageParam = string | Pick<SearchQueryKey[0], 'body' | 'headers' | 'path' | 'query'>;
type SearchQueryData = InfiniteData<ReturnType<typeof SearchPageSchema.parse>, SearchPageParam>;
export type SearchWorkspaceQueryOptions = Omit<
  UseInfiniteQueryOptions<
    SearchWorkspaceResponse,
    ApiRequestError,
    SearchQueryData,
    SearchQueryKey,
    SearchPageParam
  >,
  'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam' | 'select' | 'enabled'
>;

export type SearchWorkspaceQueryResult = UseInfiniteQueryResult<SearchQueryData, ApiRequestError>;

export async function fetchSearchResults(
  client: ClientRuntime['client'],
  q: string,
  context: QueryFunctionContext<SearchQueryKey, SearchPageParam>,
): Promise<SearchWorkspaceResponse> {
  const { queryFn } = searchWorkspaceInfiniteOptions({ client, query: { q, limit: '20' } });
  if (typeof queryFn !== 'function') throw new Error('Search query is unavailable.');

  return queryFn(context);
}

export function useSearchWorkspaceInfiniteQuery(
  {
    q,
    attempt = 0,
    runtime,
    scope,
  }: {
    attempt?: number;
    q: string;
    runtime: ClientRuntime;
    scope: QueryScope;
  },
  options: SearchWorkspaceQueryOptions = {},
): SearchWorkspaceQueryResult {
  const client = useQueryClient();
  const [generation, setGeneration] = useState(0);

  useRealtime(undefined, () => setGeneration((current) => current + 1));

  useEffect(() => {
    const restart = () => setGeneration((current) => current + 1);
    const unfocus = focusManager.subscribe((focused) => {
      if (focused) restart();
    });
    const unonline = onlineManager.subscribe((online) => {
      if (online) restart();
    });
    const unmutate = client.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || !['success', 'error'].includes(event.action.type)) return;

      const key = event.mutation.options.mutationKey;
      const taskChanged =
        key &&
        ['task-placement', 'task-write'].includes(String(key[0])) &&
        key[1] === scope.revision &&
        key[2] === scope.userId &&
        key[3] === scope.workspaceId;
      if (configurationChanged(key, event.action.type, scope) || taskChanged) restart();
    });

    return () => {
      unfocus();
      unonline();
      unmutate();
    };
  }, [client, scope]);

  const { queryKey } = withQueryScope(
    searchWorkspaceInfiniteOptions({ client: runtime.client, query: { q, limit: '20' } }),
    scope,
    [`search-generation:${generation}`, `search-attempt:${attempt}`],
  );

  return useInfiniteQuery<
    SearchWorkspaceResponse,
    ApiRequestError,
    SearchQueryData,
    SearchQueryKey,
    SearchPageParam
  >({
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
    queryKey,
    queryFn: (context) => fetchSearchResults(runtime.client, q, context),
    enabled: Boolean(q),
    initialPageParam: { query: { q } },
    getNextPageParam: (page) => {
      const parsed = SearchPageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
    select: (data) => {
      const pages = data.pages.map((page) => SearchPageSchema.parse(page));
      const first = pages[0];
      if (
        first &&
        pages.some(
          (page) =>
            page.configVersion !== first.configVersion || page.dataVersion !== first.dataVersion,
        )
      ) {
        throw new Error('Search results changed. Search again for current results.');
      }

      return { ...data, pages };
    },
  });
}
