'use client';

import { useMutation } from '@tanstack/react-query';

import type { DefaultError, UseMutationOptions, UseMutationResult } from '@tanstack/react-query';

export type ApiMutationOptions<TData, TError, TVariables, TOnMutateResult> = Omit<
  UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  'networkMode' | 'retry'
> &
  Required<
    Pick<
      UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
      'mutationFn' | 'mutationKey'
    >
  >;

function observeMutation<TArguments extends unknown[]>(
  observer: ((...args: TArguments) => unknown) | undefined,
) {
  if (!observer) return undefined;

  return async (...args: TArguments) => {
    try {
      await observer(...args);
    } catch {
      globalThis.reportError?.(new Error('An API mutation observer failed.'));
    }
  };
}

export function useApiMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(
  options: ApiMutationOptions<TData, TError, TVariables, TOnMutateResult>,
): UseMutationResult<TData, TError, TVariables, TOnMutateResult> {
  return useMutation({
    ...options,
    networkMode: 'always',
    retry: false,
    onSuccess: observeMutation(options.onSuccess),
    onError: observeMutation(options.onError),
    onSettled: observeMutation(options.onSettled),
  });
}
