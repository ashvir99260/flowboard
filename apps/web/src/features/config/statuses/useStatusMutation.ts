'use client';

import { useQueryClient } from '@tanstack/react-query';

import {
  createScopeStatusMutation,
  removeScopeStatusMutation,
  updateScopeStatusMutation,
} from '../../../generated/apiHooks.gen';
import { apiError, ApiMutationError } from '../../../lib/apiError';
import { useApiMutation } from '../../../lib/useApiMutation';
import { useNotifications } from '../../notifications/useNotifications';
import { configurationChanged } from '../configurationEvents';

import { readStatusWriteResponse } from './statusWriteData';

import type { statusCommand } from './statusFormData';
import type { QueryScope } from '../../../lib/queryScope';
import type { ClientRuntime } from '../../../providers/sessionContext';
import type { StatusScope } from '@flowboard/contracts';
import type {
  MutationFunctionContext,
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query';

type Command =
  | NonNullable<ReturnType<typeof statusCommand>>
  | { body: { expectedConfigVersion: number }; kind: 'remove'; statusId: string };
class InvalidStatusResponse extends Error {}

export type StatusMutationVariables = Command;

export type StatusMutationData =
  Extract<ReturnType<typeof readStatusWriteResponse>, { success: true }>['response'] | null;

type StatusMutationContext = { report: ReturnType<ReturnType<typeof useNotifications>['capture']> };
export type StatusMutationOptions = Omit<
  UseMutationOptions<
    StatusMutationData,
    ApiMutationError,
    StatusMutationVariables,
    StatusMutationContext
  >,
  'mutationKey' | 'mutationFn' | 'retry' | 'networkMode' | 'onMutate'
>;

export type StatusMutationResult = UseMutationResult<
  StatusMutationData,
  ApiMutationError,
  StatusMutationVariables,
  StatusMutationContext
>;

export async function requestStatus(
  requestClient: ClientRuntime['client'],
  scope: QueryScope,
  owner: StatusScope,
  command: StatusMutationVariables,

  mutationContext: MutationFunctionContext,
): Promise<StatusMutationData> {
  try {
    if (command.kind === 'remove') {
      await removeScopeStatusMutation({ client: requestClient }).mutationFn(
        { ...{ path: { ...owner, statusId: command.statusId }, body: command.body } },
        mutationContext,
      );

      return null;
    }

    const response =
      command.kind === 'create'
        ? await createScopeStatusMutation({ client: requestClient }).mutationFn(
            { path: owner, body: command.body },
            mutationContext,
          )
        : await updateScopeStatusMutation({ client: requestClient }).mutationFn(
            { path: { ...owner, statusId: command.statusId }, body: command.body },
            mutationContext,
          );
    const parsed = readStatusWriteResponse(response, {
      owner,
      workspaceId: scope.workspaceId,
      command,
    });
    if (!parsed.success)
      throw new InvalidStatusResponse(
        'The saved configuration could not be validated. Reload before continuing.',
      );

    return parsed.response;
  } catch (cause) {
    throw new ApiMutationError(
      cause instanceof InvalidStatusResponse
        ? { code: 'INVALID_RESPONSE', message: cause.message }
        : apiError(cause),
    );
  }
}

export function useStatusMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  owner: StatusScope,
  options: StatusMutationOptions = {},
): StatusMutationResult {
  const notifications = useNotifications();

  const capture = notifications.captureFactory();

  const client = useQueryClient();

  const mutationKey = ['configuration-write', scope.revision, scope.userId, scope.workspaceId];

  const mutation = useApiMutation<
    StatusMutationData,
    ApiMutationError,
    StatusMutationVariables,
    StatusMutationContext
  >({
    ...options,
    mutationKey,
    mutationFn: (command, mutationContext) =>
      requestStatus(runtime.client, scope, owner, command, mutationContext),
    onMutate: () => {
      const report = capture();
      if (
        client.isMutating({
          predicate: (entry) => configurationChanged(entry.options.mutationKey, 'success', scope),
        }) > 1
      ) {
        throw new ApiMutationError({
          code: 'BUSY',
          message: 'Another configuration change is saving.',
        });
      }

      return { report };
    },
    onSuccess: async (response, command, context, mutationContext) => {
      context?.report(
        { create: 'Status created.', remove: 'Status removed.', update: 'Status saved.' }[
          command.kind
        ],
        'success',
      );
      await options.onSuccess?.(response, command, context, mutationContext);
    },
    onError: async (error, command, context, mutationContext) => {
      context?.report(error.message, 'error');
      await options.onError?.(error, command, context, mutationContext);
    },
  });

  return mutation;
}
