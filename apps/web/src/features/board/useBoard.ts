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
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { apiError } from '../../lib/apiError';
import { withQueryScope } from '../../lib/queryScope';
import { useBackgroundRefresh } from '../../lib/useBackgroundRefresh';
import { configurationChanged } from '../config/configurationEvents';
import { useRealtime } from '../realtime/useRealtime';
import { taskMutationAffectsList } from '../tasks/taskEvents';

import { assembleBoard, readBoardStatuses } from './boardData';
import { projectPlacements } from './taskPlacement';

import type { BoardPageRequest, BoardResult } from './boardData';
import type { TaskPlacement } from './taskPlacement';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

type ReadyBoard = Extract<BoardResult, { state: 'ready' }>;

const maxPagesPerColumn = 100;
const pagePolicy = {
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
  staleTime: Infinity,
} as const;

function boardView(result: BoardResult, error: ReturnType<typeof apiError> | null, stale: boolean) {
  if (stale)
    return {
      state: 'error' as const,
      title: 'Board changed while loading',
      message: 'Updates arrived while the board was loading. Try again.',
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
    };

  if (result.state === 'invalid')
    return {
      state: 'error' as const,
      title: 'Board data unavailable',
      message: 'The board response could not be displayed. Try again.',
    };

  return result.state === 'ready' ? result : { state: 'loading' as const };
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
  const latest = useRef<{ generation: number; value: ReadyBoard } | null>(null);
  const [attempt, setAttempt] = useState<{
    generation: number;
    pages: BoardPageRequest[];
    restarts: number;
    snapshot: ReadyBoard | null;
  }>({ generation: 0, restarts: 0, pages: [], snapshot: null });

  const refresh = useCallback(
    (retain = false, command?: TaskPlacement) => {
      if (!retain) latest.current = null;

      setAttempt((current) => {
        const previous = retain
          ? (current.snapshot ??
            (latest.current?.generation === current.generation ? latest.current.value : null))
          : null;
        const snapshot =
          previous && command
            ? { ...previous, columns: projectPlacements(previous.columns, listId, [command]) }
            : previous;

        return { generation: current.generation + 1, restarts: 0, pages: [], snapshot };
      });
    },
    [listId],
  );

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
  const view = boardView(result, error, stale);
  const retrying = stale && attempt.restarts < 2;

  useEffect(() => {
    if (view.state === 'ready') latest.current = { generation: attempt.generation, value: view };

    if (view.state === 'error' && !retrying) latest.current = null;
  }, [view, attempt.generation, retrying]);

  const background = useBackgroundRefresh(
    () => refresh(true),
    view.state === 'loading' || retrying,
    view.state === 'error' && !retrying,
  );

  const retry = background.request;

  useRealtime(listId, (event, context) => {
    if (event.kind === 'list' || (event.kind === 'resync' && context?.listId === listId))
      background.request();
    else {
      background.clear();
      refresh();
    }
  });

  useEffect(() => {
    const unfocus = focusManager.subscribe((focused) => {
      if (focused) background.request();
    });
    const unonline = onlineManager.subscribe((online) => {
      if (online) background.request();
    });

    const unmutate = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || !['success', 'error'].includes(event.action.type)) return;

      const key = event.mutation.options.mutationKey;
      if (configurationChanged(key, event.action.type, scope)) {
        background.clear();
        refresh();

        return;
      }

      if (!taskMutationAffectsList(key, event.mutation.state.variables, scope, listId)) return;

      const code = event.action.type === 'error' ? apiError(event.mutation.state.error).code : null;
      const retain =
        !code ||
        ['INTERNAL_ERROR', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR', 'RATE_LIMITED'].includes(code);
      if (retain && key?.[0] !== 'task-placement') background.request();
      else {
        background.clear();
        refresh(
          retain,
          retain && event.action.type === 'success'
            ? (event.mutation.state.variables as TaskPlacement)
            : undefined,
        );
      }
    });

    return () => {
      unmutate();
      unfocus();
      unonline();
    };
  }, [background, queryClient, listId, refresh, scope]);

  if (attempt.snapshot && (view.state === 'ready' || (view.state === 'error' && !retrying)))
    setAttempt({ ...attempt, snapshot: null });

  if (retrying) {
    setAttempt({
      ...attempt,
      generation: attempt.generation + 1,
      restarts: attempt.restarts + 1,
      pages: [],
    });
  }

  const retained = attempt.snapshot && (view.state === 'loading' || retrying);
  const visible = retained ? attempt.snapshot! : view;
  if (visible.state !== 'ready') return { ...visible, retry };

  const refreshing = Boolean(retained);

  const loading = new Set(
    requests.filter((_, index) => taskQueries[index]?.isFetching).map(({ statusId }) => statusId),
  );
  const atLimit = new Set(
    visible.columns
      .filter(
        ({ status }) =>
          requests.filter(({ statusId }) => statusId === status.id).length >= maxPagesPerColumn,
      )
      .map(({ status }) => status.id),
  );
  const loadMore = (statusId: string) => {
    if (refreshing) return;

    const cursor = visible.columns.find(({ status }) => status.id === statusId)?.nextCursor;
    if (!cursor || loading.has(statusId) || atLimit.has(statusId)) return;

    setAttempt((current) =>
      current.pages.some((page) => page.statusId === statusId && page.cursor === cursor)
        ? current
        : { ...current, pages: [...current.pages, { statusId, cursor }] },
    );
  };

  return { ...visible, loading, atLimit, loadMore, retry, refreshing };
}
