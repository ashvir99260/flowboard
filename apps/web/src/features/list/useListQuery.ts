'use client';

import {
  getListResolvedFieldsOptions,
  getListResolvedStatusesOptions,
  listTasksInfiniteOptions,
} from '@flowboard/api-client/tanstack-query';
import { TaskPageSchema } from '@flowboard/contracts';
import {
  focusManager,
  onlineManager,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { apiError } from '../../lib/apiError';
import { withQueryScope } from '../../lib/queryScope';
import { useBackgroundRefresh } from '../../lib/useBackgroundRefresh';
import { readBoardStatuses } from '../board/boardData';
import { configurationChanged } from '../config/configurationEvents';
import { useRealtime } from '../realtime/useRealtime';
import { taskMutationAffectsList } from '../tasks/taskEvents';

import { assembleTaskList, readListFields } from './listData';
import { readListFilter } from './listFilter';
import { writeListLocation } from './listLocation';

import type { TaskTableQuery } from './listLocation';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { QueryClient } from '@tanstack/react-query';

const pagePolicy = {
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
} as const;
const maxPages = 100;
type ReadyList = Extract<ReturnType<typeof assembleTaskList>, { state: 'ready' }>;

function subscribeChanges(
  client: QueryClient,
  scope: QueryScope,
  listId: string,
  refresh: (retain: boolean) => void,
) {
  const unfocus = focusManager.subscribe((focused) => {
    if (focused) refresh(true);
  });
  const unonline = onlineManager.subscribe((online) => {
    if (online) refresh(true);
  });
  const unmutate = client.getMutationCache().subscribe((event) => {
    if (event.type !== 'updated' || !['success', 'error'].includes(event.action.type)) return;

    if (configurationChanged(event.mutation.options.mutationKey, event.action.type, scope)) {
      refresh(false);

      return;
    }

    if (
      taskMutationAffectsList(
        event.mutation.options.mutationKey,
        event.mutation.state.variables,
        scope,
        listId,
      )
    ) {
      const code = event.action.type === 'error' ? apiError(event.mutation.state.error).code : null;
      refresh(
        !code ||
          ['INTERNAL_ERROR', 'SERVICE_UNAVAILABLE', 'NETWORK_ERROR', 'RATE_LIMITED'].includes(code),
      );
    }
  });

  return () => {
    unfocus();
    unonline();
    unmutate();
  };
}

export function useListQuery({
  listId,
  runtime,
  scope,
  query,
}: {
  listId: string;
  query: TaskTableQuery;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const instance = useId();
  const client = useQueryClient();

  const signature = writeListLocation(query);

  const latest = useRef<{ signature: string; value: ReadyList } | null>(null);

  const [attempt, setAttempt] = useState({
    signature,
    generation: 0,
    queryRevision: 0,
    restarts: 0,
    snapshot: null as ReadyList | null,
  });

  const changed = attempt.signature !== signature;

  const refresh = useCallback(
    (retain = false) => {
      const snapshot =
        retain && latest.current?.signature === signature ? latest.current.value : null;
      if (!retain) latest.current = null;

      setAttempt((current) => ({
        ...current,
        signature,
        generation: current.generation + 1,
        restarts: 0,
        snapshot,
      }));
    },
    [signature],
  );

  const tags = [`list:${instance}:${attempt.generation}`];
  const taskTags = [`list:${instance}:${signature}:${attempt.generation}:${attempt.queryRevision}`];

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

  const statuses = readBoardStatuses(statusesQuery.data, scope.workspaceId!);
  const fields = readListFields(fieldsQuery.data, scope.workspaceId!, listId);
  const filter = fields.state === 'ready' ? readListFilter(query, fields.items) : null;
  const configured =
    statuses.state === 'ready' &&
    fields.state === 'ready' &&
    statuses.configVersion === fields.configVersion;

  const tasks = useInfiniteQuery({
    ...withQueryScope(
      listTasksInfiniteOptions({
        client: runtime.client,
        path: { listId },
        query: { ...query, limit: '50' },
      }),
      scope,
      taskTags,
    ),
    ...pagePolicy,
    enabled: configured && filter?.ok === true && !changed,
    initialPageParam: { path: { listId }, query: {} },
    getNextPageParam: (page, pages) => {
      const parsed = TaskPageSchema.safeParse(page);

      return parsed.success && pages.length < maxPages
        ? (parsed.data.pageInfo.nextCursor ?? undefined)
        : undefined;
    },
  });

  const pages =
    tasks.data?.pages.map((response, index) => {
      const param = tasks.data.pageParams[index];

      return { response, ...(typeof param === 'string' ? { cursor: param } : {}) };
    }) ?? [];
  const result = assembleTaskList({
    workspaceId: scope.workspaceId!,
    listId,
    query,
    statuses: statusesQuery.data,
    fields: fieldsQuery.data,
    pages,
  });
  const failed = [statusesQuery, fieldsQuery, tasks].find((entry) => entry.isError);
  const error = failed ? apiError(failed.error) : null;
  const stale = result.state === 'stale' || error?.code === 'CURSOR_STALE';
  const restarting = changed || (stale && attempt.restarts < 2);

  useEffect(() => {
    if ((error && !restarting) || result.state === 'invalid') latest.current = null;
    else if (!changed && result.state === 'ready') latest.current = { signature, value: result };
  }, [changed, error, restarting, result, signature]);

  const background = useBackgroundRefresh(
    () => refresh(true),
    restarting || result.state === 'pending',
    Boolean(error && !restarting) || result.state === 'invalid',
  );

  useRealtime(listId, (event) => {
    if (event.kind === 'list') background.request();
    else {
      background.clear();
      refresh();
    }
  });

  useEffect(
    () =>
      subscribeChanges(client, scope, listId, (retain) => {
        if (retain) background.request();
        else {
          background.clear();
          refresh();
        }
      }),
    [background, client, listId, refresh, scope],
  );

  const retry = background.request;
  const retained =
    !changed &&
    attempt.snapshot &&
    !error &&
    result.state !== 'invalid' &&
    (restarting || result.state === 'pending');
  const visible = retained
    ? attempt.snapshot!
    : restarting
      ? { state: 'pending' as const }
      : result;
  const refreshing = Boolean(retained);
  if (
    attempt.snapshot &&
    !restarting &&
    (result.state === 'ready' || error || result.state === 'invalid')
  )
    setAttempt({ ...attempt, snapshot: null });

  const atLimit =
    pages.length >= maxPages && result.state === 'ready' && result.nextCursor !== null;
  const loadMore = () => {
    if (!refreshing && !tasks.isFetching && !atLimit && tasks.hasNextPage)
      void tasks.fetchNextPage();
  };

  if (changed) {
    setAttempt({
      ...attempt,
      signature,
      queryRevision: attempt.queryRevision + 1,
      restarts: 0,
      snapshot: null,
    });
  } else if (stale && attempt.restarts < 2) {
    setAttempt({ ...attempt, generation: attempt.generation + 1, restarts: attempt.restarts + 1 });
  }

  return {
    fields:
      visible.state === 'ready' ? visible.fields : fields.state === 'ready' ? fields.items : [],
    statuses:
      visible.state === 'ready'
        ? visible.statuses
        : statuses.state === 'ready'
          ? statuses.items
          : [],
    configured: configured || visible.state === 'ready',
    result: visible,
    refreshing,
    error: restarting ? null : error,
    filterError: filter && !filter.ok ? filter.message : null,
    retry,
    loadMore,
    loadingMore: tasks.isFetchingNextPage,
    atLimit,
  };
}
