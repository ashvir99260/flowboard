import { withQueryScope } from './queryScope';

import type { QueryScope } from './queryScope';
import type { ApiMutationOptions } from './useApiMutation';
import type { ClientRuntime } from '../providers/sessionContext';
import type { UseMutationOptions } from '@tanstack/react-query';

export type ApiContext = {
  runtime: Pick<ClientRuntime, 'client'>;
  scope: QueryScope;
  tags?: readonly string[];
};

export type ApiParameters<T> = Pick<
  NonNullable<T>,
  Extract<keyof NonNullable<T>, 'body' | 'path' | 'query'>
>;

export type ApiClientParameters<T> = NonNullable<T> & { client: ClientRuntime['client'] };

export function apiRequest<T extends ApiContext>(input: T) {
  return {
    ...('body' in input ? { body: input.body } : {}),
    ...('path' in input ? { path: input.path } : {}),
    ...('query' in input ? { query: input.query } : {}),
    client: input.runtime.client,
  } as ApiParameters<T> & { client: ClientRuntime['client'] };
}

export function mergeQueryOptions<
  T extends { queryFn?: unknown; queryKey: readonly unknown[] },
  TOptions extends object,
>(definition: T, options: TOptions) {
  if (typeof definition.queryFn !== 'function')
    throw new Error('Generated query function is unavailable.');

  return {
    ...definition,
    ...options,
    queryKey: definition.queryKey,
    queryFn: definition.queryFn as Extract<T['queryFn'], (...args: never[]) => unknown>,
  };
}

export function scopeQuery<T extends { queryKey: readonly [{ tags?: readonly string[] }] }>(
  definition: T,
  context: ApiContext,
): T {
  return withQueryScope(definition, context.scope, context.tags);
}

export function bindMutation<TData, TError, TVariables extends object, TContext>(
  definition: UseMutationOptions<TData, TError, TVariables>,
  client: ClientRuntime['client'],
  options: Omit<
    UseMutationOptions<TData, TError | Error, ApiParameters<TVariables>, TContext>,
    'mutationFn' | 'mutationKey' | 'retry' | 'networkMode'
  >,
): ApiMutationOptions<TData, TError | Error, ApiParameters<TVariables>, TContext> {
  const { mutationFn, mutationKey } = definition;
  if (!mutationFn || !mutationKey)
    throw new Error('Generated mutation is missing its function or key.');

  return {
    ...options,
    mutationKey,
    meta: { ...definition.meta, ...options.meta },
    mutationFn: (variables, context) =>
      mutationFn(
        {
          ...('body' in variables ? { body: variables.body } : {}),
          ...('path' in variables ? { path: variables.path } : {}),
          ...('query' in variables ? { query: variables.query } : {}),
          client,
        } as TVariables,
        context,
      ),
  };
}

export function scopeMutation<T extends { mutationKey: readonly unknown[] }>(
  definition: T,
  context: ApiContext,
): T {
  const first = definition.mutationKey[0];
  if (!first || typeof first !== 'object' || Array.isArray(first))
    throw new Error('Generated mutation key is invalid.');

  const { queryKey } = withQueryScope(
    { queryKey: definition.mutationKey as readonly [{ tags?: readonly string[] }] },
    context.scope,
    context.tags,
  );

  return { ...definition, mutationKey: queryKey };
}
