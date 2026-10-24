'use client';

import {
  getListResolvedFieldsOptions,
  getListResolvedStatusesOptions,
  listTasksOptions,
} from '@flowboard/api-client/tanstack-query';
import {
  focusManager,
  onlineManager,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { withQueryScope } from '../../lib/query-scope';
import { configurationChanged } from '../config/configuration-events';
import { useRealtime } from '../realtime/realtime-provider';
import { taskMutationAffectsList } from '../tasks/task-events';

import { assembleBoard, readBoardStatuses } from './board-data';

import type { BoardPageRequest, BoardResult } from './board-data';
import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

const maxPagesPerColumn = 100;
const pagePolicy = {
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  staleTime: Infinity,
} as const;

function boardView(
  result: BoardResult,
  error: ReturnType<typeof apiError> | null,
  stale: boolean,
  retry: () => void,
) {
  if (stale)
    return {
      state: 'error' as const,
      title: 'Board changed while loading',
      message: 'Updates arrived while the board was loading. Try again.',
      retry,
    };

  if (error)
    return {
      state: 'error' as const,
      title:
        error.code === 'FORBIDDEN'
          ? 'Access denied'
          : error.code === 'NOT_FOUND'
            ? 'List unavailable'
            : 'Unable to load board',
      message: error.message,
      retry,
    };

  if (result.state === 'invalid')
    return {
      state: 'error' as const,
      title: 'Board data unavailable',
      message: 'The board response could not be displayed. Try again.',
      retry,
    };

  return result.state === 'ready' ? result : { state: 'loading' as const, retry };
}

export function useBoard({
  runtime,
  scope,
  listId,
}: {
  listId: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const instance = useId();
  const queryClient = useQueryClient();
  const [attempt, setAttempt] = useState<{
    generation: number;
    pages: BoardPageRequest[];
    restarts: number;
  }>({ generation: 0, restarts: 0, pages: [] });
  useRealtime(listId, () =>
    setAttempt((current) => ({ generation: current.generation + 1, restarts: 0, pages: [] })),
  );
  useEffect(() => {
    const refresh = () =>
      setAttempt((current) => ({ generation: current.generation + 1, restarts: 0, pages: [] }));
    const unfocus = focusManager.subscribe((focused) => {
      if (focused) refresh();
    });
    const unonline = onlineManager.subscribe((online) => {
      if (online) refresh();
    });

    const unmutate = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || !['success', 'error'].includes(event.action.type)) return;

      if (
        configurationChanged(event.mutation.options.mutationKey, event.action.type, scope) ||
        taskMutationAffectsList(
          event.mutation.options.mutationKey,
          event.mutation.state.variables,
          scope,
          listId,
        )
      )
        refresh();
    });

    return () => {
      unmutate();
      unfocus();
      unonline();
    };
  }, [queryClient, listId, scope]);
  const tags = [`board:${instance}:${attempt.generation}`];
  const statusesQuery = useQuery({
    ...withQueryScope(
      getListResolvedStatusesOptions({ client: runtime.client, path: { listId } }),
      scope,
      tags,
    ),
    ...pagePolicy,
  });
  const fieldsQuery = useQuery({
    ...withQueryScope(
      getListResolvedFieldsOptions({ client: runtime.client, path: { listId } }),
      scope,
      tags,
    ),
    ...pagePolicy,
  });
  const statuses = readBoardStatuses(statusesQuery.data, scope.workspaceId ?? '');
  const requests: BoardPageRequest[] =
    statuses.state === 'ready'
      ? [...statuses.items.map(({ id }) => ({ statusId: id })), ...attempt.pages]
      : [];
  const taskQueries = useQueries({
    queries: requests.map(({ statusId, cursor }) => ({
      ...withQueryScope(
        listTasksOptions({
          client: runtime.client,
          path: { listId },
          query: { statusId, cursor, sort: 'manual', direction: 'asc', limit: '50' },
        }),
        scope,
        tags,
      ),
      ...pagePolicy,
    })),
  });
  const failure = [statusesQuery, fieldsQuery, ...taskQueries].find((query) => query.isError);
  const error = failure ? apiError(failure.error) : null;
  const pages = taskQueries.flatMap((query, index) =>
    query.data === undefined ? [] : [{ request: requests[index]!, response: query.data }],
  );
  const result = assembleBoard({
    workspaceId: scope.workspaceId ?? '',
    listId,
    statuses: statusesQuery.data,
    fields: fieldsQuery.data,
    pages,
  });
  const stale = error ? error.code === 'CURSOR_STALE' : result.state === 'stale';
  const retry = () =>
    setAttempt((current) => ({ generation: current.generation + 1, restarts: 0, pages: [] }));

  if (stale && attempt.restarts < 2) {
    setAttempt({ generation: attempt.generation + 1, restarts: attempt.restarts + 1, pages: [] });

    return { state: 'loading' as const, retry };
  }

  const view = boardView(result, error, stale, retry);
  if (view.state !== 'ready') return view;

  const loading = new Set(
    requests.filter((_, index) => taskQueries[index]?.isFetching).map(({ statusId }) => statusId),
  );
  const atLimit = new Set(
    view.columns
      .filter(
        ({ status }) =>
          requests.filter(({ statusId }) => statusId === status.id).length >= maxPagesPerColumn,
      )
      .map(({ status }) => status.id),
  );
  const loadMore = (statusId: string) => {
    const cursor = view.columns.find(({ status }) => status.id === statusId)?.nextCursor;
    if (!cursor || loading.has(statusId) || atLimit.has(statusId)) return;

    setAttempt((current) =>
      current.pages.some((page) => page.statusId === statusId && page.cursor === cursor)
        ? current
        : { ...current, pages: [...current.pages, { statusId, cursor }] },
    );
  };

  return { ...view, loading, atLimit, loadMore, retry };
}
