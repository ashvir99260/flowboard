'use client';

import { getCurrentUserOptions } from '@flowboard/api-client/tanstack-query';
import { useQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/queryScope';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export function useGetCurrentUserQuery({
  runtime,
  scope,
}: {
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  return useQuery(withQueryScope(getCurrentUserOptions({ client: runtime.client }), scope));
}
