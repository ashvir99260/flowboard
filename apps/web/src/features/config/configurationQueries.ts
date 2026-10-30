'use client';

import {
  getListResolvedFields,
  getListResolvedStatuses,
  listScopeFields,
  listScopeStatuses,
} from '@flowboard/api-client/sdk';
import {
  getListResolvedFieldsOptions as generatedGetListResolvedFieldsOptions,
  getListResolvedStatusesOptions as generatedGetListResolvedStatusesOptions,
  listScopeFieldsOptions as generatedListScopeFieldsOptions,
  listScopeStatusesOptions as generatedListScopeStatusesOptions,
} from '@flowboard/api-client/tanstack-query';

import type { ApiRequestError } from '../../lib/apiError';
import type { ClientRuntime } from '../../providers/sessionContext';
import type {
  GetListResolvedFieldsResponse,
  GetListResolvedStatusesResponse,
  ListScopeFieldsResponse,
  ListScopeStatusesResponse,
} from '@flowboard/api-client/types';
import type { QueryFunctionContext, UseQueryOptions } from '@tanstack/react-query';

type GetListResolvedFieldsParameters = Parameters<
  typeof generatedGetListResolvedFieldsOptions
>[0] & { client: ClientRuntime['client'] };
type GetListResolvedFieldsKey = ReturnType<
  typeof generatedGetListResolvedFieldsOptions
>['queryKey'];
export type GetListResolvedFieldsQueryOptions = Omit<
  UseQueryOptions<
    GetListResolvedFieldsResponse,
    ApiRequestError,
    GetListResolvedFieldsResponse,
    GetListResolvedFieldsKey
  >,
  'queryKey' | 'queryFn'
>;

export async function fetchListResolvedFields(
  parameters: GetListResolvedFieldsParameters,
  signal?: AbortSignal,
): Promise<GetListResolvedFieldsResponse> {
  const { data } = await getListResolvedFields({ ...parameters, signal, throwOnError: true });

  return data;
}

export function getListResolvedFieldsOptions(
  parameters: GetListResolvedFieldsParameters,
  options: GetListResolvedFieldsQueryOptions = {},
) {
  return {
    ...options,
    queryKey: generatedGetListResolvedFieldsOptions(parameters).queryKey,
    queryFn: ({ signal }: QueryFunctionContext<GetListResolvedFieldsKey>) =>
      fetchListResolvedFields(parameters, signal),
  };
}

type GetListResolvedStatusesParameters = Parameters<
  typeof generatedGetListResolvedStatusesOptions
>[0] & { client: ClientRuntime['client'] };
type GetListResolvedStatusesKey = ReturnType<
  typeof generatedGetListResolvedStatusesOptions
>['queryKey'];
export type GetListResolvedStatusesQueryOptions = Omit<
  UseQueryOptions<
    GetListResolvedStatusesResponse,
    ApiRequestError,
    GetListResolvedStatusesResponse,
    GetListResolvedStatusesKey
  >,
  'queryKey' | 'queryFn'
>;

export async function fetchListResolvedStatuses(
  parameters: GetListResolvedStatusesParameters,
  signal?: AbortSignal,
): Promise<GetListResolvedStatusesResponse> {
  const { data } = await getListResolvedStatuses({ ...parameters, signal, throwOnError: true });

  return data;
}

export function getListResolvedStatusesOptions(
  parameters: GetListResolvedStatusesParameters,
  options: GetListResolvedStatusesQueryOptions = {},
) {
  return {
    ...options,
    queryKey: generatedGetListResolvedStatusesOptions(parameters).queryKey,
    queryFn: ({ signal }: QueryFunctionContext<GetListResolvedStatusesKey>) =>
      fetchListResolvedStatuses(parameters, signal),
  };
}

type ListScopeFieldsParameters = Parameters<typeof generatedListScopeFieldsOptions>[0] & {
  client: ClientRuntime['client'];
};
type ListScopeFieldsKey = ReturnType<typeof generatedListScopeFieldsOptions>['queryKey'];
export type ListScopeFieldsQueryOptions = Omit<
  UseQueryOptions<
    ListScopeFieldsResponse,
    ApiRequestError,
    ListScopeFieldsResponse,
    ListScopeFieldsKey
  >,
  'queryKey' | 'queryFn'
>;

export async function fetchScopeFields(
  parameters: ListScopeFieldsParameters,
  signal?: AbortSignal,
): Promise<ListScopeFieldsResponse> {
  const { data } = await listScopeFields({ ...parameters, signal, throwOnError: true });

  return data;
}

export function listScopeFieldsOptions(
  parameters: ListScopeFieldsParameters,
  options: ListScopeFieldsQueryOptions = {},
) {
  return {
    ...options,
    queryKey: generatedListScopeFieldsOptions(parameters).queryKey,
    queryFn: ({ signal }: QueryFunctionContext<ListScopeFieldsKey>) =>
      fetchScopeFields(parameters, signal),
  };
}

type ListScopeStatusesParameters = Parameters<typeof generatedListScopeStatusesOptions>[0] & {
  client: ClientRuntime['client'];
};
type ListScopeStatusesKey = ReturnType<typeof generatedListScopeStatusesOptions>['queryKey'];
export type ListScopeStatusesQueryOptions = Omit<
  UseQueryOptions<
    ListScopeStatusesResponse,
    ApiRequestError,
    ListScopeStatusesResponse,
    ListScopeStatusesKey
  >,
  'queryKey' | 'queryFn'
>;

export async function fetchScopeStatuses(
  parameters: ListScopeStatusesParameters,
  signal?: AbortSignal,
): Promise<ListScopeStatusesResponse> {
  const { data } = await listScopeStatuses({ ...parameters, signal, throwOnError: true });

  return data;
}

export function listScopeStatusesOptions(
  parameters: ListScopeStatusesParameters,
  options: ListScopeStatusesQueryOptions = {},
) {
  return {
    ...options,
    queryKey: generatedListScopeStatusesOptions(parameters).queryKey,
    queryFn: ({ signal }: QueryFunctionContext<ListScopeStatusesKey>) =>
      fetchScopeStatuses(parameters, signal),
  };
}
