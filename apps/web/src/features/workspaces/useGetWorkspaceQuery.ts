'use client';

import { getWorkspaceOptions } from '@flowboard/api-client/tanstack-query';
import { useQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/queryScope';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export function useGetWorkspaceQuery(runtime: ClientRuntime, scope: QueryScope) {
  return useQuery(
    withQueryScope(
      getWorkspaceOptions({ client: runtime.client, path: { workspaceId: scope.workspaceId! } }),
      scope,
    ),
  );
}
