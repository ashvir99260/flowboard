'use client';

import { getCurrentUser } from '@flowboard/api-client/sdk';
import { getCurrentUserQueryKey } from '@flowboard/api-client/tanstack-query';
import { useQuery } from '@tanstack/react-query';

import { withQueryScope } from '../../lib/queryScope';

import type { ApiRequestError } from '../../lib/apiError';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { GetCurrentUserResponse } from '@flowboard/api-client/types';
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query';

type CurrentUserQueryKey = ReturnType<typeof getCurrentUserQueryKey>;
export type GetCurrentUserQueryOptions = Omit<
  UseQueryOptions<
    GetCurrentUserResponse,
    ApiRequestError,
    GetCurrentUserResponse,
    CurrentUserQueryKey
  >,
  'queryFn' | 'queryKey'
>;

export type GetCurrentUserQueryResult = UseQueryResult<GetCurrentUserResponse, ApiRequestError>;

export async function fetchCurrentUser(
  client: ClientRuntime['client'],
  signal?: AbortSignal,
): Promise<GetCurrentUserResponse> {
  const { data } = await getCurrentUser({ client, signal, throwOnError: true });

  return data;
}

export function useGetCurrentUserQuery(
  {
    runtime,
    scope,
  }: {
    runtime: ClientRuntime;
    scope: QueryScope;
  },
  options: GetCurrentUserQueryOptions = {},
): GetCurrentUserQueryResult {
  const { queryKey } = withQueryScope(
    { queryKey: getCurrentUserQueryKey({ client: runtime.client }) },
    scope,
  );

  return useQuery({
    ...options,
    queryKey,
    queryFn: ({ signal }) => fetchCurrentUser(runtime.client, signal),
  });
}
