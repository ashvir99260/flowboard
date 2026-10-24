'use client';

import { listWorkspacesInfiniteOptions } from '@flowboard/api-client/tanstack-query';
import { WorkspacePageSchema } from '@flowboard/contracts';
import { useInfiniteQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/query-scope';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

export function useListWorkspacesInfiniteQuery({
  generation,
  runtime,
  scope,
}: {
  generation: number;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  return useInfiniteQuery({
    ...withQueryScope(
      listWorkspacesInfiniteOptions({ client: runtime.client, query: { limit: '50' } }),
      scope,
      [`memberships-attempt:${generation}`],
    ),
    initialPageParam: { query: {} },
    getNextPageParam: (page) => {
      const parsed = WorkspacePageSchema.safeParse(page);

      return parsed.success ? (parsed.data.pageInfo.nextCursor ?? undefined) : undefined;
    },
  });
}
