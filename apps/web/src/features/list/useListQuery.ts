'use client';

import { TaskPageSchema } from '@flowboard/contracts';
import {
  focusManager,
  onlineManager,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import {
  getListResolvedFieldsOptions,
  getListResolvedStatusesOptions,
} from '../../generated/apiHooks.gen';
import { listTasksInfiniteOptions } from '../../generated/apiHooks.gen';
import { apiError } from '../../lib/apiError';
import { withQueryScope } from '../../lib/queryScope';
import { readBoardStatuses } from '../board/boardData';
import { configurationChanged } from '../config/configurationEvents';
import { useRealtime } from '../realtime/useRealtime';
import { taskMutationAffectsList } from '../tasks/taskEvents';

import { assembleTaskList, readListFields } from './listData';
import { readListFilter } from './listFilter';
import { writeListLocation } from './listLocation';

import type { TaskTableQuery } from './listLocation';
import type {
  GetListResolvedFieldsQueryOptions,
  GetListResolvedStatusesQueryOptions,
} from '../../generated/apiHooks.gen';
import type { ListTasksInfiniteQueryOptions } from '../../generated/apiHooks.gen';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { ResolvedField, ResolvedStatus } from '@flowboard/contracts';
import type { QueryClient } from '@tanstack/react-query';

const pagePolicy = {
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
} as const;
const maxPages = 100;

function subscribeChanges(
  client: QueryClient,
  scope: QueryScope,
  listId: string,
  refresh: () => void,
) {
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
    unfocus();
    unonline();
    unmutate();
  };
}

export type ListQueryOptions = {
  fields?: GetListResolvedFieldsQueryOptions;
  statuses?: GetListResolvedStatusesQueryOptions;
  tasks?: ListTasksInfiniteQueryOptions;
};

export type ListQueryResult = {
  atLimit: boolean;
  configured: boolean;
  error: ReturnType<typeof apiError> | null;
  fields: ResolvedField[];
  filterError: string | null;
  loadingMore: boolean;
  loadMore: () => void;
  result: ReturnType<typeof assembleTaskList>;
  retry: () => void;
  statuses: ResolvedStatus[];
};

export function useListQuery(
  {
    listId,
    runtime,
    scope,
    query,
  }: {
    listId: string;
    query: TaskTableQuery;
    runtime: ClientRuntime;
    scope: QueryScope;
  },
  options: ListQueryOptions = {},
): ListQueryResult {
  const instance = useId();
  const client = useQueryClient();

  const signature = writeListLocation(query);

  const [attempt, setAttempt] = useState({
    signature,
    generation: 0,
    queryRevision: 0,
    restarts: 0,
  });

  useRealtime(listId, () =>
    setAttempt((current) => ({
      ...current,
      signature,
      generation: current.generation + 1,
      restarts: 0,
    })),
  );

  const changed = attempt.signature !== signature;
  const retry = () =>
    setAttempt((current) => ({
      ...current,
      signature,
      generation: current.generation + 1,
      restarts: 0,
    }));

  useEffect(
    () =>
      subscribeChanges(client, scope, listId, () =>
        setAttempt((current) => ({ ...current, generation: current.generation + 1, restarts: 0 })),
      ),
    [client, listId, scope],
  );

  const tags = [`list:${instance}:${attempt.generation}`];
  const taskTags = [`list:${instance}:${signature}:${attempt.generation}:${attempt.queryRevision}`];

  const statusesQuery = useQuery({
    ...withQueryScope(
      getListResolvedStatusesOptions(
        { client: runtime.client, path: { listId } },
        { ...pagePolicy, ...options.statuses },
      ),
      scope,
      tags,
    ),
  });
  const fieldsQuery = useQuery({
    ...withQueryScope(
      getListResolvedFieldsOptions(
        { client: runtime.client, path: { listId } },
        { ...pagePolicy, ...options.fields },
      ),
      scope,
      tags,
    ),
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
      listTasksInfiniteOptions(
        {
          client: runtime.client,
          path: { listId },
          query: { ...query, limit: '50' },
        },
        { ...pagePolicy, ...options.tasks },
      ),
      scope,
      taskTags,
    ),
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
  const atLimit =
    pages.length >= maxPages && result.state === 'ready' && result.nextCursor !== null;
  const loadMore = () => {
    if (!tasks.isFetching && !atLimit && tasks.hasNextPage) void tasks.fetchNextPage();
  };

  if (changed) {
    setAttempt({ ...attempt, signature, queryRevision: attempt.queryRevision + 1, restarts: 0 });
  } else if (stale && attempt.restarts < 2) {
    setAttempt({ ...attempt, generation: attempt.generation + 1, restarts: attempt.restarts + 1 });
  }

  const restarting = changed || (stale && attempt.restarts < 2);

  return {
    fields: fields.state === 'ready' ? fields.items : [],
    statuses: statuses.state === 'ready' ? statuses.items : [],
    configured,
    result: restarting ? { state: 'pending' as const } : result,
    error: restarting ? null : error,
    filterError: filter && !filter.ok ? filter.message : null,
    retry,
    loadMore,
    loadingMore: tasks.isFetchingNextPage,
    atLimit,
  };
}
