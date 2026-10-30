'use client';

import { GrantPageSchema, MemberPageSchema, TreePageSchema } from '@flowboard/contracts';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useState } from 'react';

import {
  listNodeGrantsInfiniteOptions,
  listVisibleTreeInfiniteOptions,
} from '../../generated/apiHooks.gen';
import { listWorkspaceMembersInfiniteOptions } from '../../generated/apiHooks.gen';
import { apiError } from '../../lib/apiError';
import { withQueryScope } from '../../lib/queryScope';
import { configurationChanged } from '../config/configurationEvents';
import { useRealtime } from '../realtime/useRealtime';

import { readAdministration } from './administrationData';

import type {
  ListNodeGrantsInfiniteQueryOptions,
  ListVisibleTreeInfiniteQueryOptions,
} from '../../generated/apiHooks.gen';
import type { ListWorkspaceMembersInfiniteQueryOptions } from '../../generated/apiHooks.gen';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

const policy = {
  retry: false,
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
} as const;

export type AdministrationQueryOptions = {
  grants?: ListNodeGrantsInfiniteQueryOptions;
  members?: ListWorkspaceMembersInfiniteQueryOptions;
  tree?: ListVisibleTreeInfiniteQueryOptions;
};

export type AdministrationQueryResult = {
  error: ReturnType<typeof apiError> | null;
  generation: number;
  refresh: () => void;
  result: ReturnType<typeof readAdministration>;
};

export function useAdministration(
  runtime: ClientRuntime,
  scope: QueryScope,
  nodeId?: string,
  options: AdministrationQueryOptions = {},
): AdministrationQueryResult {
  const instance = useId();
  const client = useQueryClient();
  const [attempt, setAttempt] = useState({ generation: 0, restarts: 0 });
  const refresh = useCallback(
    () => setAttempt((value) => ({ generation: value.generation + 1, restarts: 0 })),
    [],
  );

  useRealtime(undefined, refresh);

  useEffect(
    () =>
      client.getMutationCache().subscribe((event) => {
        if (
          event.type === 'updated' &&
          configurationChanged(event.mutation.options.mutationKey, event.action.type, scope)
        )
          refresh();
      }),
    [client, refresh, scope],
  );

  const tags = [`administration:${instance}:${attempt.generation}`];

  const tree = useInfiniteQuery({
    ...withQueryScope(
      listVisibleTreeInfiniteOptions(
        { client: runtime.client, query: { limit: '50' } },
        { ...policy, ...options.tree },
      ),
      scope,
      tags,
    ),
    initialPageParam: { query: {} },
    getNextPageParam: (page, pages) => {
      const parsed = TreePageSchema.safeParse(page);

      return parsed.success && pages.length < 100
        ? (parsed.data.pageInfo.nextCursor ?? undefined)
        : undefined;
    },
  });
  const members = useInfiniteQuery({
    ...withQueryScope(
      listWorkspaceMembersInfiniteOptions(
        {
          client: runtime.client,
          path: { workspaceId: scope.workspaceId! },
          query: { limit: '50' },
        },
        { ...policy, ...options.members },
      ),
      scope,
      tags,
    ),
    initialPageParam: { path: { workspaceId: scope.workspaceId! }, query: {} },
    getNextPageParam: (page, pages) => {
      const parsed = MemberPageSchema.safeParse(page);

      return parsed.success && pages.length < 100
        ? (parsed.data.pageInfo.nextCursor ?? undefined)
        : undefined;
    },
  });
  const grants = useInfiniteQuery({
    ...withQueryScope(
      listNodeGrantsInfiniteOptions(
        {
          client: runtime.client,
          path: { nodeId: nodeId ?? scope.workspaceId! },
          query: { limit: '50' },
        },
        { ...policy, ...options.grants },
      ),
      scope,
      tags,
    ),
    enabled: Boolean(nodeId),
    initialPageParam: { path: { nodeId: nodeId ?? scope.workspaceId! }, query: {} },
    getNextPageParam: (page, pages) => {
      const parsed = GrantPageSchema.safeParse(page);

      return parsed.success && pages.length < 100
        ? (parsed.data.pageInfo.nextCursor ?? undefined)
        : undefined;
    },
  });

  useEffect(() => {
    for (const query of [tree, members, ...(nodeId ? [grants] : [])])
      if (query.hasNextPage && !query.isFetching && !query.isError)
        void query.fetchNextPage({ cancelRefetch: false });
  }, [tree, members, grants, nodeId]);

  const result = readAdministration({
    workspaceId: scope.workspaceId!,
    nodeId,
    treePages: tree.data?.pages,
    memberPages: members.data?.pages,
    grantPages: grants.data?.pages,
  });
  const queries = [tree, members, ...(nodeId ? [grants] : [])];
  const failed = queries.find((query) => query.isError);
  const error = failed ? apiError(failed.error) : null;
  const atLimit =
    queries.some((query) => (query.data?.pages.length ?? 0) >= 100) && result.state === 'pending';
  if ((result.state === 'stale' || error?.code === 'CURSOR_STALE') && attempt.restarts < 2) {
    setAttempt({ generation: attempt.generation + 1, restarts: attempt.restarts + 1 });

    return {
      result: { state: 'pending' as const },
      error: null,
      refresh,
      generation: attempt.generation,
    };
  }

  return {
    result,
    refresh,
    generation: attempt.generation,
    error: atLimit
      ? {
          code: 'PAGE_LIMIT',
          message:
            'Administration exceeds the 5,000-row limit. Narrow the workspace before editing.',
        }
      : error,
  };
}
