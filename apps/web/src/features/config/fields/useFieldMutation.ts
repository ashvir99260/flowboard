'use client';

import { createScopeField, removeScopeField, updateScopeField } from '@flowboard/api-client/sdk';
import { useQueryClient } from '@tanstack/react-query';

import { apiError, ApiMutationError } from '../../../lib/apiError';
import { useApiMutation } from '../../../lib/useApiMutation';
import { useNotifications } from '../../notifications/useNotifications';
import { configurationChanged } from '../configurationEvents';

import { readFieldWriteResponse } from './fieldWriteData';

import type { fieldCommand } from './fieldFormData';
import type { QueryScope } from '../../../lib/queryScope';
import type { ClientRuntime } from '../../../providers/sessionContext';
import type { FieldScope } from '@flowboard/contracts';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';

type Command =
  | NonNullable<ReturnType<typeof fieldCommand>>
  | { body: { expectedConfigVersion: number }; fieldId: string; kind: 'remove' };
class InvalidFieldResponse extends Error {}

export type FieldMutationVariables = Command;

export type FieldMutationData =
  Extract<ReturnType<typeof readFieldWriteResponse>, { success: true }>['response'] | null;

type FieldMutationContext = { report: ReturnType<ReturnType<typeof useNotifications>['capture']> };
export type FieldMutationOptions = Omit<
  UseMutationOptions<
    FieldMutationData,
    ApiMutationError,
    FieldMutationVariables,
    FieldMutationContext
  >,
  'mutationKey' | 'mutationFn' | 'retry' | 'networkMode' | 'onMutate'
>;

export type FieldMutationResult = UseMutationResult<
  FieldMutationData,
  ApiMutationError,
  FieldMutationVariables,
  FieldMutationContext
>;

export async function requestField(
  requestClient: ClientRuntime['client'],
  scope: QueryScope,
  owner: FieldScope,
  command: FieldMutationVariables,
): Promise<FieldMutationData> {
  try {
    if (command.kind === 'remove') {
      await removeScopeField({
        ...{ path: { ...owner, fieldId: command.fieldId }, body: command.body },
        client: requestClient,
        throwOnError: true,
      });

      return null;
    }

    const response =
      command.kind === 'create'
        ? (
            await createScopeField({
              path: owner,
              body: command.body,
              client: requestClient,
              throwOnError: true,
            })
          ).data
        : (
            await updateScopeField({
              path: { ...owner, fieldId: command.fieldId },
              body: command.body,
              client: requestClient,
              throwOnError: true,
            })
          ).data;
    const parsed = readFieldWriteResponse(response, {
      owner,
      workspaceId: scope.workspaceId,
      command,
    });
    if (!parsed.success)
      throw new InvalidFieldResponse(
        'The saved configuration could not be validated. Reload before continuing.',
      );

    return parsed.response;
  } catch (cause) {
    throw new ApiMutationError(
      cause instanceof InvalidFieldResponse
        ? { code: 'INVALID_RESPONSE', message: cause.message }
        : apiError(cause),
    );
  }
}

export function useFieldMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  owner: FieldScope,
  options: FieldMutationOptions = {},
): FieldMutationResult {
  const notifications = useNotifications();

  const capture = notifications.captureFactory();

  const client = useQueryClient();

  const mutationKey = ['configuration-write', scope.revision, scope.userId, scope.workspaceId];

  const mutation = useApiMutation<
    FieldMutationData,
    ApiMutationError,
    FieldMutationVariables,
    FieldMutationContext
  >({
    ...options,
    mutationKey,
    mutationFn: (command) => requestField(runtime.client, scope, owner, command),
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
        { create: 'Field created.', remove: 'Field removed.', update: 'Field saved.' }[
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
