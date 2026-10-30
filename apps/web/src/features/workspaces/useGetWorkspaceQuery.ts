'use client';

import { getWorkspace } from '@flowboard/api-client/sdk';
import { getWorkspaceQueryKey } from '@flowboard/api-client/tanstack-query';
import { useQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/queryScope';

import type { ApiRequestError } from '../../lib/apiError';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { GetWorkspaceResponse } from '@flowboard/api-client/types';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

type WorkspaceQueryKey = ReturnType<typeof getWorkspaceQueryKey>;
export type GetWorkspaceQueryOptions = Omit<
  UseQueryOptions<GetWorkspaceResponse, ApiRequestError, GetWorkspaceResponse, WorkspaceQueryKey>,
  'queryFn' | 'queryKey'
>;

export type GetWorkspaceQueryResult = UseQueryResult<GetWorkspaceResponse, ApiRequestError>;

export async function fetchWorkspace(
  client: ClientRuntime['client'],
  workspaceId: string,
  signal?: AbortSignal,
): Promise<GetWorkspaceResponse> {
  const { data } = await getWorkspace({
    client,
    path: { workspaceId },
    signal,
    throwOnError: true,
  });

  return data;
}

export function useGetWorkspaceQuery(
  runtime: ClientRuntime,
  scope: QueryScope,
  options: GetWorkspaceQueryOptions = {},
): GetWorkspaceQueryResult {
  const workspaceId = scope.workspaceId!;
  const { queryKey } = withQueryScope(
    { queryKey: getWorkspaceQueryKey({ client: runtime.client, path: { workspaceId } }) },
    scope,
  );

  return useQuery({
    ...options,
    queryKey,
    queryFn: ({ signal }) => fetchWorkspace(runtime.client, workspaceId, signal),
  });
}
