'use client';

import { getNodeOptions } from '@flowboard/api-client/tanstack-query';
import { useQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/queryScope';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export function useGetNodeQuery({
  nodeId,
  runtime,
  scope,
}: {
  nodeId: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  return useQuery(
    withQueryScope(getNodeOptions({ client: runtime.client, path: { nodeId } }), scope),
  );
}
