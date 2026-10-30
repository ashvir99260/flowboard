'use client';

import { getTask, listTasks } from '@flowboard/api-client/sdk';
import {
  getTaskOptions as generatedGetTaskOptions,
  listTasksInfiniteOptions as generatedListTasksInfiniteOptions,
  listTasksOptions as generatedListTasksOptions,
} from '@flowboard/api-client/tanstack-query';

import type { ApiRequestError } from '../../lib/apiError';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { GetTaskResponse, ListTasksResponse } from '@flowboard/api-client/types';
import type {
  InfiniteData,
  QueryFunctionContext,
  UseInfiniteQueryOptions,
  UseQueryOptions,
} from '@tanstack/react-query';

type GetTaskParameters = Parameters<typeof generatedGetTaskOptions>[0] & {
  client: ClientRuntime['client'];
};
type GetTaskKey = ReturnType<typeof generatedGetTaskOptions>['queryKey'];
export type GetTaskQueryOptions = Omit<
  UseQueryOptions<GetTaskResponse, ApiRequestError, GetTaskResponse, GetTaskKey>,
  'queryKey' | 'queryFn'
>;

export async function fetchTask(
  parameters: GetTaskParameters,
  signal?: AbortSignal,
): Promise<GetTaskResponse> {
  const { data } = await getTask({ ...parameters, signal, throwOnError: true });

  return data;
}

export function getTaskOptions(parameters: GetTaskParameters, options: GetTaskQueryOptions = {}) {
  return {
    ...options,
    queryKey: generatedGetTaskOptions(parameters).queryKey,
    queryFn: ({ signal }: QueryFunctionContext<GetTaskKey>) => fetchTask(parameters, signal),
  };
}

type ListTasksParameters = Parameters<typeof generatedListTasksOptions>[0] & {
  client: ClientRuntime['client'];
};
type ListTasksKey = ReturnType<typeof generatedListTasksOptions>['queryKey'];
export type ListTasksQueryOptions = Omit<
  UseQueryOptions<ListTasksResponse, ApiRequestError, ListTasksResponse, ListTasksKey>,
  'queryKey' | 'queryFn'
>;

export async function fetchTasks(
  parameters: ListTasksParameters,
  signal?: AbortSignal,
): Promise<ListTasksResponse> {
  const { data } = await listTasks({ ...parameters, signal, throwOnError: true });

  return data;
}

export function listTasksOptions(
  parameters: ListTasksParameters,
  options: ListTasksQueryOptions = {},
) {
  return {
    ...options,
    queryKey: generatedListTasksOptions(parameters).queryKey,
    queryFn: ({ signal }: QueryFunctionContext<ListTasksKey>) => fetchTasks(parameters, signal),
  };
}

type ListTasksPageParameters = Parameters<typeof generatedListTasksInfiniteOptions>[0] & {
  client: ClientRuntime['client'];
};
export type ListTasksPageKey = ReturnType<typeof generatedListTasksInfiniteOptions>['queryKey'];

export type ListTasksPageParam =
  string | Pick<ListTasksPageKey[0], 'body' | 'headers' | 'path' | 'query'>;

export type ListTasksPageData = InfiniteData<ListTasksResponse, ListTasksPageParam>;

export type ListTasksInfiniteQueryOptions = Omit<
  UseInfiniteQueryOptions<
    ListTasksResponse,
    ApiRequestError,
    ListTasksPageData,
    ListTasksPageKey,
    ListTasksPageParam
  >,
  'queryKey' | 'queryFn' | 'initialPageParam' | 'getNextPageParam'
>;

export async function fetchTaskPage(
  parameters: ListTasksPageParameters,
  context: QueryFunctionContext<ListTasksPageKey, ListTasksPageParam>,
): Promise<ListTasksResponse> {
  const { queryFn } = generatedListTasksInfiniteOptions(parameters);
  if (typeof queryFn !== 'function') throw new Error('API page request is unavailable.');

  return queryFn(context);
}

export function listTasksInfiniteOptions(
  parameters: ListTasksPageParameters,
  options: ListTasksInfiniteQueryOptions = {},
) {
  return {
    ...options,
    queryKey: generatedListTasksInfiniteOptions(parameters).queryKey,
    queryFn: (context: QueryFunctionContext<ListTasksPageKey, ListTasksPageParam>) =>
      fetchTaskPage(parameters, context),
  };
}
