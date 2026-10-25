'use client';

import { searchWorkspaceInfiniteOptions } from '@flowboard/api-client/tanstack-query';
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

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export function useSearchWorkspaceInfiniteQuery({
  q,
  attempt = 0,
  runtime,
  scope,
}: {
  attempt?: number;
  q: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
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

  return useInfiniteQuery({
    ...withQueryScope(
      searchWorkspaceInfiniteOptions({ client: runtime.client, query: { q, limit: '20' } }),
      scope,
      [`search-generation:${generation}`, `search-attempt:${attempt}`],
    ),
    enabled: Boolean(q),
    initialPageParam: { query: { q } },
    getNextPageParam: (page) => {
      const parsed = SearchPageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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
