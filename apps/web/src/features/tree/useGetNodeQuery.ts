'use client';

import { getNode } from '@flowboard/api-client/sdk';
import { getNodeQueryKey } from '@flowboard/api-client/tanstack-query';
import { useQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/queryScope';

import type { ApiRequestError } from '../../lib/apiError';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { GetNodeResponse } from '@flowboard/api-client/types';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

type NodeQueryKey = ReturnType<typeof getNodeQueryKey>;
export type GetNodeQueryOptions = Omit<
  UseQueryOptions<GetNodeResponse, ApiRequestError, GetNodeResponse, NodeQueryKey>,
  'queryFn' | 'queryKey'
>;

export type GetNodeQueryResult = UseQueryResult<GetNodeResponse, ApiRequestError>;

export async function fetchNode(
  client: ClientRuntime['client'],
  nodeId: string,
  signal?: AbortSignal,
): Promise<GetNodeResponse> {
  const { data } = await getNode({ client, path: { nodeId }, signal, throwOnError: true });

  return data;
}

export function useGetNodeQuery(
  {
    nodeId,
    runtime,
    scope,
  }: {
    nodeId: string;
    runtime: ClientRuntime;
    scope: QueryScope;
  },
  options: GetNodeQueryOptions = {},
): GetNodeQueryResult {
  const { queryKey } = withQueryScope(
    { queryKey: getNodeQueryKey({ client: runtime.client, path: { nodeId } }) },
    scope,
  );

  return useQuery({
    ...options,
    queryKey,
    queryFn: ({ signal }) => fetchNode(runtime.client, nodeId, signal),
  });
}
