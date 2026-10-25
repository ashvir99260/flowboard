'use client';

import { listTasksInfiniteOptions } from '@flowboard/api-client/tanstack-query';
import { TaskPageSchema } from '@flowboard/contracts';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { apiError } from '../../lib/apiError';
import { withQueryScope } from '../../lib/queryScope';
import { configurationChanged } from '../config/configurationEvents';
import { useRealtime } from '../realtime/useRealtime';

import { taskMutationAffectsList } from './taskEvents';
import { readTaskRelations } from './taskRelationsData';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export function useListRelatedTasksInfiniteQuery({
  enabled = true,
  listId,
  parentTaskId,
  runtime,
  scope,
}: {
  enabled?: boolean;
  listId: string;
  parentTaskId?: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const instance = useId();
  const client = useQueryClient();
  const [attempt, setAttempt] = useState({ generation: 0, restarts: 0 });

  const refresh = () => setAttempt((value) => ({ generation: value.generation + 1, restarts: 0 }));

  useRealtime(enabled ? listId : undefined, refresh);

  useEffect(
    () =>
      client.getMutationCache().subscribe((event) => {
        if (
          !enabled ||
          event.type !== 'updated' ||
          !['success', 'error'].includes(event.action.type)
        )
          return;

        if (
          configurationChanged(event.mutation.options.mutationKey, event.action.type, scope) ||
          taskMutationAffectsList(
            event.mutation.options.mutationKey,
            event.mutation.state.variables,
            scope,
            listId,
          )
        )
          setAttempt((value) => ({ generation: value.generation + 1, restarts: 0 }));
      }),
    [client, enabled, listId, scope],
  );

  const query = useInfiniteQuery({
    ...withQueryScope(
      listTasksInfiniteOptions({
        client: runtime.client,
        path: { listId },
        query: { limit: '50', ...(parentTaskId ? { parentTaskId } : {}) },
      }),
      scope,
      [`task-relations:${instance}:${attempt.generation}`],
    ),
    enabled,
    initialPageParam: { path: { listId }, query: {} },
    getNextPageParam: (page, pages) => {
      const parsed = TaskPageSchema.safeParse(page);

      return parsed.success && pages.length < 100
        ? (parsed.data.pageInfo.nextCursor ?? undefined)
        : undefined;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: false,
  });

  const result = readTaskRelations({
    listId,
    workspaceId: scope.workspaceId!,
    parentTaskId,
    pages:
      query.data?.pages.map((response, index) => ({
        response,
        ...(typeof query.data.pageParams[index] === 'string'
          ? { cursor: query.data.pageParams[index] as string }
          : {}),
      })) ?? [],
  });
  const error = query.isError ? apiError(query.error) : null;
  if (
    enabled &&
    (result.state === 'stale' || error?.code === 'CURSOR_STALE') &&
    attempt.restarts < 2
  ) {
    setAttempt({ generation: attempt.generation + 1, restarts: attempt.restarts + 1 });

    return { result: { state: 'pending' as const }, error: null, query, refresh };
  }

  return {
    result,
    query,
    refresh,
    error:
      result.state === 'ready' && result.nextCursor && (query.data?.pages.length ?? 0) >= 100
        ? { code: 'PAGE_LIMIT', message: 'The list is too large to load more related tasks.' }
        : error,
  };
}
