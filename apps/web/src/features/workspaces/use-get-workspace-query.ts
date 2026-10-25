'use client';

import { getWorkspaceOptions } from '@flowboard/api-client/tanstack-query';
import { useQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/query-scope';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

export function useGetWorkspaceQuery(runtime: ClientRuntime, scope: QueryScope) {
  return useQuery(
    withQueryScope(
      getWorkspaceOptions({ client: runtime.client, path: { workspaceId: scope.workspaceId! } }),
      scope,
    ),
  );
}
