'use client';

import {
  getListResolvedFieldsOptions,
  getListResolvedStatusesOptions,
  getTaskOptions,
  listWorkspaceMembersInfiniteOptions,
} from '@flowboard/api-client/tanstack-query';
import { MemberPageSchema } from '@flowboard/contracts';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';

import { apiError } from '../../lib/apiError';
import { withQueryScope } from '../../lib/queryScope';

import { assembleTaskDetail } from './taskDetailData';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

const policy = {
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export function useTaskDetail(
  runtime: ClientRuntime,
  scope: QueryScope,
  listId: string,
  taskId?: string,
) {
  const id = useId();
  const [attempt, setAttempt] = useState({ generation: 0, restarts: 0 });

  const tags = [`task-detail:${id}:${attempt.generation}`];
  const scoped = <T extends { queryKey: readonly [{ tags?: readonly string[] }] }>(options: T) =>
    withQueryScope(options, scope, tags);

  const statuses = useQuery({
    ...scoped(getListResolvedStatusesOptions({ client: runtime.client, path: { listId } })),
    ...policy,
  });
  const fields = useQuery({
    ...scoped(getListResolvedFieldsOptions({ client: runtime.client, path: { listId } })),
    ...policy,
  });
  const task = useQuery({
    ...scoped(getTaskOptions({ client: runtime.client, path: { taskId: taskId ?? listId } })),
    ...policy,
    enabled: Boolean(taskId),
  });
  const members = useInfiniteQuery({
    ...scoped(
      listWorkspaceMembersInfiniteOptions({
        client: runtime.client,
        path: { workspaceId: scope.workspaceId! },
        query: { limit: '50', assignableToListId: listId },
      }),
    ),
    ...policy,
    initialPageParam: { path: { workspaceId: scope.workspaceId! }, query: {} },
    getNextPageParam: (page) => {
      const parsed = MemberPageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
  });

  const result = assembleTaskDetail({
    listId,
    workspaceId: scope.workspaceId!,
    taskId,
    task: task.data,
    statuses: statuses.data,
    fields: fields.data,
    memberPages:
      members.data?.pages.map((response, index) => ({
        response,
        ...(typeof members.data.pageParams[index] === 'string'
          ? { cursor: members.data.pageParams[index] as string }
          : {}),
      })) ?? [],
  });
  const full = (members.data?.pages.length ?? 0) >= 100 && members.hasNextPage;

  useEffect(() => {
    if (
      members.hasNextPage &&
      !members.isFetching &&
      !members.isError &&
      result.state === 'pending' &&
      !full
    )
      void members.fetchNextPage();
  }, [members, result.state, full]);

  const failed = [statuses, fields, members, ...(taskId ? [task] : [])].find(
    (query) => query.isError,
  );
  const error = failed ? apiError(failed.error) : null;
  const retry = () =>
    setAttempt((current) => ({ generation: current.generation + 1, restarts: 0 }));
  if ((result.state === 'stale' || error?.code === 'CURSOR_STALE') && attempt.restarts < 2) {
    setAttempt({ generation: attempt.generation + 1, restarts: attempt.restarts + 1 });

    return { result: { state: 'pending' as const }, error: null, retry };
  }

  return {
    result,
    error: full
      ? {
          code: 'PAGE_LIMIT',
          message: 'Too many members to load. Contact your workspace administrator.',
        }
      : error,
    retry,
  };
}
