'use client';

import { listVisibleTreeInfiniteOptions } from '@flowboard/api-client/tanstack-query';
import { TreePageSchema } from '@flowboard/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { withQueryScope } from '../../lib/query-scope';
import { useRealtime } from '../realtime/realtime-provider';

import { assembleTree } from './assemble-tree';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

function treeProgress(value: unknown, hasNext: boolean, workspaceId: string) {
  if (value === undefined) return { state: 'waiting' as const };

  const parsed = TreePageSchema.array().safeParse(value);
  if (!parsed.success) return { state: 'invalid' as const, restart: true };

  const cursors = parsed.data.flatMap((page) => page.pageInfo.nextCursor ?? []);
  if (new Set(cursors).size !== cursors.length || (hasNext && parsed.data.length >= 100))
    return { state: 'invalid' as const, restart: false };

  if (hasNext) return { state: 'waiting' as const };

  const complete = assembleTree(parsed.data, workspaceId);
  if (!complete.ok) return { state: 'invalid' as const, restart: true };

  return {
    state: 'ready' as const,
    items: complete.items,
    nodes: parsed.data.flatMap((page) => page.items),
  };
}

export function useTree(runtime: ClientRuntime, scope: QueryScope) {
  const [attempt, setAttempt] = useState(0);
  useRealtime(undefined, () => setAttempt((current) => current + 1));
  const query = useInfiniteQuery({
    ...withQueryScope(
      listVisibleTreeInfiniteOptions({ client: runtime.client, query: { limit: '50' } }),
      scope,
      [`tree-attempt:${attempt}`],
    ),
    initialPageParam: { query: {} },
    getNextPageParam: (page) => {
      const parsed = TreePageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
  });
  const progress = treeProgress(query.data?.pages, query.hasNextPage, scope.workspaceId!);
  const stale =
    (query.isError && apiError(query.error).code === 'CURSOR_STALE') ||
    (progress.state === 'invalid' && progress.restart);
  const { isFetching, isError, fetchNextPage } = query;
  const fetchMore = progress.state === 'waiting' && query.hasNextPage;
  useEffect(() => {
    if (fetchMore && !isFetching && !isError) void fetchNextPage();
  }, [fetchMore, isFetching, isError, fetchNextPage]);

  if (stale && attempt === 0) setAttempt(1);

  if (
    (stale && attempt === 0) ||
    query.isPending ||
    (progress.state === 'waiting' && !query.isError)
  )
    return { state: 'loading' as const };

  const retry = () => setAttempt((current) => current + 1);
  if (query.isError || progress.state !== 'ready')
    return {
      state: 'error' as const,
      message: query.isError
        ? apiError(query.error).message
        : 'Navigation changed or returned an incomplete response. Try again.',
      retry,
    };

  return { ...progress, retry };
}
