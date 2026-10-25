'use client';

import { useMutation } from '@tanstack/react-query';

import type { DefaultError, UseMutationOptions } from '@tanstack/react-query';

type ApiMutationOptions<TData, TError, TVariables, TOnMutateResult> = Omit<
  UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
  'networkMode' | 'retry'
> &
  Required<
    Pick<
      UseMutationOptions<TData, TError, TVariables, TOnMutateResult>,
      'mutationFn' | 'mutationKey'
    >
  >;

export function useApiMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TOnMutateResult = unknown,
>(options: ApiMutationOptions<TData, TError, TVariables, TOnMutateResult>) {
  return useMutation({ ...options, networkMode: 'always', retry: false });
}
