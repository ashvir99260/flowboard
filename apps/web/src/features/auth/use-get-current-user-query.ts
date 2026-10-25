'use client';

import { getCurrentUserOptions } from '@flowboard/api-client/tanstack-query';
import { useQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/query-scope';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

export function useGetCurrentUserQuery({
  runtime,
  scope,
}: {
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  return useQuery(withQueryScope(getCurrentUserOptions({ client: runtime.client }), scope));
}
