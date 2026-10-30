'use client';

import { listWorkspaceMembersInfiniteOptions as generatedListWorkspaceMembersInfiniteOptions } from '@flowboard/api-client/tanstack-query';

import type { ApiRequestError } from '../../lib/apiError';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { ListWorkspaceMembersResponse } from '@flowboard/api-client/types';
import type {
  InfiniteData,
  QueryFunctionContext,
  UseInfiniteQueryOptions,
} from '@tanstack/react-query';

type ListWorkspaceMembersPageParameters = Parameters<
  typeof generatedListWorkspaceMembersInfiniteOptions
>[0] & { client: ClientRuntime['client'] };
export type ListWorkspaceMembersPageKey = ReturnType<
  typeof generatedListWorkspaceMembersInfiniteOptions
>['queryKey'];

export type ListWorkspaceMembersPageParam =
  string | Pick<ListWorkspaceMembersPageKey[0], 'body' | 'headers' | 'path' | 'query'>;

export type ListWorkspaceMembersPageData = InfiniteData<
  ListWorkspaceMembersResponse,
  ListWorkspaceMembersPageParam
>;

export type ListWorkspaceMembersInfiniteQueryOptions = Omit<
  UseInfiniteQueryOptions<
    ListWorkspaceMembersResponse,
    ApiRequestError,
    ListWorkspaceMembersPageData,
    ListWorkspaceMembersPageKey,
    ListWorkspaceMembersPageParam
  >,
  'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

export async function fetchWorkspaceMembers(
  parameters: ListWorkspaceMembersPageParameters,
  context: QueryFunctionContext<ListWorkspaceMembersPageKey, ListWorkspaceMembersPageParam>,
): Promise<ListWorkspaceMembersResponse> {
  const { queryFn } = generatedListWorkspaceMembersInfiniteOptions(parameters);
  if (typeof queryFn !== 'function') throw new Error('API page request is unavailable.');

  return queryFn(context);
}

export function listWorkspaceMembersInfiniteOptions(
  parameters: ListWorkspaceMembersPageParameters,
  options: ListWorkspaceMembersInfiniteQueryOptions = {},
) {
  return {
    ...options,
    queryKey: generatedListWorkspaceMembersInfiniteOptions(parameters).queryKey,
    queryFn: (
      context: QueryFunctionContext<ListWorkspaceMembersPageKey, ListWorkspaceMembersPageParam>,
    ) => fetchWorkspaceMembers(parameters, context),
  };
}
