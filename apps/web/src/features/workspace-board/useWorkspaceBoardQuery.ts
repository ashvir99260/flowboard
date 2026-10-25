'use client';

import {
  getListResolvedFieldsOptions,
  getListResolvedStatusesOptions,
  listTasksOptions,
} from '@flowboard/api-client/tanstack-query';
import { focusManager, onlineManager, useQueries, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId, useState } from 'react';

import { apiError } from '../../lib/apiError';
import { withQueryScope } from '../../lib/queryScope';
import { configurationChanged } from '../config/configurationEvents';
import { assembleTaskList } from '../list/listData';
import { useRealtime } from '../realtime/useRealtime';
import { taskMutationAffectsList } from '../tasks/taskEvents';

import { workspaceSnapshotState } from './workspaceBoardData';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { WorkspaceBoardColumn, WorkspaceListNode } from './workspaceBoardData';

type Attempt = { generation: number; pages: string[]; restarts: number };
export type WorkspaceColumnState =
  | { list: WorkspaceListNode; state: 'loading' }
  | { list: WorkspaceListNode; message: string; state: 'error' }
  | (WorkspaceBoardColumn & { atLimit: boolean; loadingMore: boolean; state: 'ready' });

const emptyAttempt: Attempt = { generation: 0, pages: [], restarts: 0 };
const pagePolicy = {
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
const maxPages = 100;

export function useWorkspaceBoardQuery(
  runtime: ClientRuntime,
  scope: QueryScope,
  lists: readonly WorkspaceListNode[],
) {
  const instance = useId();
  const client = useQueryClient();
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [snapshotRestarts, setSnapshotRestarts] = useState(0);
  const retry = useCallback(
    (listId?: string) => {
      setSnapshotRestarts(0);
      setAttempts((current) => ({
        ...current,
        ...Object.fromEntries(
          lists.map((list) => {
            const previous = current[list.id] ?? emptyAttempt;

            return [
              list.id,
              listId && listId !== list.id
                ? previous
                : { generation: previous.generation + 1, pages: [], restarts: 0 },
            ];
          }),
        ),
      }));
    },
    [lists],
  );

  useRealtime(undefined, () => retry());

  useEffect(() => {
    const refresh = () => retry();
    const unfocus = focusManager.subscribe((focused) => {
      if (focused) refresh();
    });
    const unonline = onlineManager.subscribe((online) => {
      if (online) refresh();
    });
    const unmutate = client.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || !['success', 'error'].includes(event.action.type)) return;

      if (
        configurationChanged(event.mutation.options.mutationKey, event.action.type, scope) ||
        lists.some((list) =>
          taskMutationAffectsList(
            event.mutation.options.mutationKey,
            event.mutation.state.variables,
            scope,
            list.id,
          ),
        )
      )
        refresh();
    });

    return () => {
      unfocus();
      unonline();
      unmutate();
    };
  }, [client, lists, retry, scope]);

  const tags = (listId: string) => [
    `workspace-board:${instance}:${listId}:${(attempts[listId] ?? emptyAttempt).generation}`,
  ];
  const statuses = useQueries({
    queries: lists.map((list) => ({
      ...withQueryScope(
        getListResolvedStatusesOptions({ client: runtime.client, path: { listId: list.id } }),
        scope,
        tags(list.id),
      ),
      ...pagePolicy,
    })),
  });
  const fields = useQueries({
    queries: lists.map((list) => ({
      ...withQueryScope(
        getListResolvedFieldsOptions({ client: runtime.client, path: { listId: list.id } }),
        scope,
        tags(list.id),
      ),
      ...pagePolicy,
    })),
  });
  const requests = lists.flatMap((list) =>
    [undefined, ...(attempts[list.id]?.pages ?? [])].map((cursor) => ({ listId: list.id, cursor })),
  );
  const tasks = useQueries({
    queries: requests.map(({ listId, cursor }) => ({
      ...withQueryScope(
        listTasksOptions({
          client: runtime.client,
          path: { listId },
          query: { sort: 'manual', direction: 'asc', limit: '50', ...(cursor ? { cursor } : {}) },
        }),
        scope,
        tags(listId),
      ),
      ...pagePolicy,
    })),
  });

  const staleIds: string[] = [];
  const columns: WorkspaceColumnState[] = lists.map((list, index) => {
    const pageIndexes = requests.flatMap((request, pageIndex) =>
      request.listId === list.id ? [pageIndex] : [],
    );
    const failure = [
      statuses[index],
      fields[index],
      ...pageIndexes.map((pageIndex) => tasks[pageIndex]),
    ].find((query) => query?.isError);
    const result = assembleTaskList({
      workspaceId: scope.workspaceId!,
      listId: list.id,
      query: { sort: 'manual', direction: 'asc' },
      statuses: statuses[index]?.data,
      fields: fields[index]?.data,
      pages: pageIndexes.flatMap((pageIndex) =>
        tasks[pageIndex]?.data === undefined
          ? []
          : [
              {
                response: tasks[pageIndex]!.data,
                ...(requests[pageIndex]?.cursor ? { cursor: requests[pageIndex].cursor } : {}),
              },
            ],
      ),
    });
    const error = failure ? apiError(failure.error) : null;
    const attempt = attempts[list.id] ?? emptyAttempt;
    if (result.state === 'stale' || error?.code === 'CURSOR_STALE') {
      if (attempt.restarts < 2) {
        staleIds.push(list.id);
        return { list, state: 'loading' };
      }

      return {
        list,
        state: 'error',
        message: 'This list changed while loading. Retry to read the latest tasks.',
      };
    }

    if (error || result.state === 'invalid')
      return {
        list,
        state: 'error',
        message: error?.message ?? 'This list returned an invalid response. Retry to continue.',
      };

    if (result.state !== 'ready') return { list, state: 'loading' };

    return {
      list,
      state: 'ready',
      tasks: result.items,
      fields: result.fields,
      statuses: result.statuses,
      configVersion: result.configVersion,
      dataVersion: result.dataVersion,
      nextCursor: result.nextCursor,
      loadingMore: pageIndexes.some((pageIndex) => tasks[pageIndex]?.isFetching),
      atLimit: pageIndexes.length >= maxPages,
    };
  });
  const staleKey = staleIds.join(',');
  const ready = columns.filter((column) => column.state === 'ready');
  const snapshot = workspaceSnapshotState(ready);
  const snapshotKey =
    snapshot === 'stale'
      ? ready
          .map((column) => `${column.list.id}:${column.configVersion}:${column.dataVersion}`)
          .join('|')
      : '';

  useEffect(() => {
    if (!snapshotKey || snapshotRestarts >= 2) return;

    setSnapshotRestarts((current) => current + 1);
    setAttempts((current) => {
      const next = { ...current };
      for (const entry of snapshotKey.split('|')) {
        const listId = entry.split(':')[0]!;
        const previous = next[listId] ?? emptyAttempt;
        next[listId] = { ...previous, generation: previous.generation + 1, pages: [] };
      }

      return next;
    });
  }, [snapshotKey, snapshotRestarts]);

  useEffect(() => {
    if (!staleKey) return;

    setAttempts((current) => {
      const next = { ...current };
      for (const listId of staleKey.split(',')) {
        const previous = next[listId] ?? emptyAttempt;
        if (previous.restarts < 2)
          next[listId] = {
            generation: previous.generation + 1,
            pages: [],
            restarts: previous.restarts + 1,
          };
      }

      return next;
    });
  }, [staleKey]);

  const loadMore = (listId: string) => {
    const column = columns.find((item) => item.list.id === listId);
    if (column?.state !== 'ready' || !column.nextCursor || column.loadingMore || column.atLimit)
      return;

    const cursor = column.nextCursor;
    setAttempts((current) => {
      const previous = current[listId] ?? emptyAttempt;

      return previous.pages.includes(cursor)
        ? current
        : { ...current, [listId]: { ...previous, pages: [...previous.pages, cursor] } };
    });
  };

  const coherent: WorkspaceColumnState[] =
    snapshot === 'ready'
      ? columns
      : columns.map((column) =>
          column.state !== 'ready'
            ? column
            : snapshot === 'stale' && snapshotRestarts < 2
              ? { list: column.list, state: 'loading' }
              : {
                  list: column.list,
                  state: 'error',
                  message:
                    'Workspace lists changed while loading. Retry to load a consistent board.',
                },
        );

  return { columns: coherent, loadMore, retry };
}
