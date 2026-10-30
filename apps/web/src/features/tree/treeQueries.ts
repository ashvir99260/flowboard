'use client';

import {
  listNodeGrantsInfiniteOptions as generatedListNodeGrantsInfiniteOptions,
  listVisibleTreeInfiniteOptions as generatedListVisibleTreeInfiniteOptions,
} from '@flowboard/api-client/tanstack-query';

import type { ApiRequestError } from '../../lib/apiError';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { ListNodeGrantsResponse, ListVisibleTreeResponse } from '@flowboard/api-client/types';
import type {
  InfiniteData,
  QueryFunctionContext,
  UseInfiniteQueryOptions,
} from '@tanstack/react-query';

type ListVisibleTreePageParameters = Parameters<
  typeof generatedListVisibleTreeInfiniteOptions
>[0] & { client: ClientRuntime['client'] };
export type ListVisibleTreePageKey = ReturnType<
  typeof generatedListVisibleTreeInfiniteOptions
>['queryKey'];

export type ListVisibleTreePageParam =
  string | Pick<ListVisibleTreePageKey[0], 'body' | 'headers' | 'path' | 'query'>;

export type ListVisibleTreePageData = InfiniteData<
  ListVisibleTreeResponse,
  ListVisibleTreePageParam
>;

export type ListVisibleTreeInfiniteQueryOptions = Omit<
  UseInfiniteQueryOptions<
    ListVisibleTreeResponse,
    ApiRequestError,
    ListVisibleTreePageData,
    ListVisibleTreePageKey,
    ListVisibleTreePageParam
  >,
  'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

export async function fetchVisibleTree(
  parameters: ListVisibleTreePageParameters,
  context: QueryFunctionContext<ListVisibleTreePageKey, ListVisibleTreePageParam>,
): Promise<ListVisibleTreeResponse> {
  const { queryFn } = generatedListVisibleTreeInfiniteOptions(parameters);
  if (typeof queryFn !== 'function') throw new Error('API page request is unavailable.');

  return queryFn(context);
}

export function listVisibleTreeInfiniteOptions(
  parameters: ListVisibleTreePageParameters,
  options: ListVisibleTreeInfiniteQueryOptions = {},
) {
  return {
    ...options,
    queryKey: generatedListVisibleTreeInfiniteOptions(parameters).queryKey,
    queryFn: (context: QueryFunctionContext<ListVisibleTreePageKey, ListVisibleTreePageParam>) =>
      fetchVisibleTree(parameters, context),
  };
}

type ListNodeGrantsPageParameters = Parameters<typeof generatedListNodeGrantsInfiniteOptions>[0] & {
  client: ClientRuntime['client'];
};
export type ListNodeGrantsPageKey = ReturnType<
  typeof generatedListNodeGrantsInfiniteOptions
>['queryKey'];

export type ListNodeGrantsPageParam =
  string | Pick<ListNodeGrantsPageKey[0], 'body' | 'headers' | 'path' | 'query'>;

export type ListNodeGrantsPageData = InfiniteData<ListNodeGrantsResponse, ListNodeGrantsPageParam>;

export type ListNodeGrantsInfiniteQueryOptions = Omit<
  UseInfiniteQueryOptions<
    ListNodeGrantsResponse,
    ApiRequestError,
    ListNodeGrantsPageData,
    ListNodeGrantsPageKey,
    ListNodeGrantsPageParam
  >,
  'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

export async function fetchNodeGrants(
  parameters: ListNodeGrantsPageParameters,
  context: QueryFunctionContext<ListNodeGrantsPageKey, ListNodeGrantsPageParam>,
): Promise<ListNodeGrantsResponse> {
  const { queryFn } = generatedListNodeGrantsInfiniteOptions(parameters);
  if (typeof queryFn !== 'function') throw new Error('API page request is unavailable.');

  return queryFn(context);
}

export function listNodeGrantsInfiniteOptions(
  parameters: ListNodeGrantsPageParameters,
  options: ListNodeGrantsInfiniteQueryOptions = {},
) {
  return {
    ...options,
    queryKey: generatedListNodeGrantsInfiniteOptions(parameters).queryKey,
    queryFn: (context: QueryFunctionContext<ListNodeGrantsPageKey, ListNodeGrantsPageParam>) =>
      fetchNodeGrants(parameters, context),
  };
}
