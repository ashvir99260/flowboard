'use client';

import { createWorkspaceInvitation } from '@flowboard/api-client/sdk';
import { CreateInvitationSchema } from '@flowboard/contracts';
import { useQueryClient } from '@tanstack/react-query';

import { apiError, ApiMutationError } from '../../lib/apiError';
import { useApiMutation } from '../../lib/useApiMutation';
import { configurationChanged } from '../config/configurationEvents';
import { useNotifications } from '../notifications/useNotifications';

import { readCreatedInvitation } from './invitationData';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { CreateInvitation } from '@flowboard/contracts';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';

class InvitationResponseError extends Error {}

export type CreateWorkspaceInvitationMutationVariables = CreateInvitation;

export type CreateWorkspaceInvitationMutationData = NonNullable<
  ReturnType<typeof readCreatedInvitation>
>;

type CreateWorkspaceInvitationMutationContext = {
  report: ReturnType<ReturnType<typeof useNotifications>['capture']>;
};
export type CreateWorkspaceInvitationMutationOptions = Omit<
  UseMutationOptions<
    CreateWorkspaceInvitationMutationData,
    ApiMutationError,
    CreateWorkspaceInvitationMutationVariables,
    CreateWorkspaceInvitationMutationContext
  >,
  'mutationKey' | 'mutationFn' | 'retry' | 'networkMode' | 'onMutate'
>;

export type CreateWorkspaceInvitationMutationResult = UseMutationResult<
  CreateWorkspaceInvitationMutationData,
  ApiMutationError,
  CreateWorkspaceInvitationMutationVariables,
  CreateWorkspaceInvitationMutationContext
>;

export async function requestCreateWorkspaceInvitation(
  requestClient: ClientRuntime['client'],
  scope: QueryScope,
  command: CreateWorkspaceInvitationMutationVariables,
): Promise<CreateWorkspaceInvitationMutationData> {
  try {
    const body = CreateInvitationSchema.parse(command);
    const response = (
      await createWorkspaceInvitation({
        path: { workspaceId: scope.workspaceId! },
        body,
        client: requestClient,
        throwOnError: true,
      })
    ).data;
    const parsed = readCreatedInvitation(response, body.expectedConfigVersion);
    if (!parsed)
      throw new InvitationResponseError(
        'The invitation response could not be validated. Reload before creating another invitation.',
      );

    return parsed;
  } catch (cause) {
    throw new ApiMutationError(
      cause instanceof InvitationResponseError
        ? { code: 'INVALID_RESPONSE', message: cause.message }
        : apiError(cause),
    );
  }
}

export function useCreateWorkspaceInvitationMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  options: CreateWorkspaceInvitationMutationOptions = {},
): CreateWorkspaceInvitationMutationResult {
  const notifications = useNotifications();

  const capture = notifications.captureFactory();

  const client = useQueryClient();

  const mutationKey = ['configuration-write', scope.revision, scope.userId, scope.workspaceId];

  const mutation = useApiMutation<
    CreateWorkspaceInvitationMutationData,
    ApiMutationError,
    CreateWorkspaceInvitationMutationVariables,
    CreateWorkspaceInvitationMutationContext
  >({
    ...options,
    mutationKey,
    mutationFn: (command) => requestCreateWorkspaceInvitation(runtime.client, scope, command),
    onMutate: () => {
      const report = capture();
      if (
        client.isMutating({
          predicate: (entry) => configurationChanged(entry.options.mutationKey, 'success', scope),
        }) > 1
      ) {
        report('Another configuration change is saving.', 'error');
        throw new ApiMutationError({
          code: 'BUSY',
          message: 'Another configuration change is saving.',
        });
      }

      return { report };
    },
    onSuccess: async (response, command, context, mutationContext) => {
      context?.report('Invitation created. Share the private link with the recipient.', 'success');
      await options.onSuccess?.(response, command, context, mutationContext);
    },
    onError: async (error, command, context, mutationContext) => {
      context?.report(error.message, 'error');
      await options.onError?.(error, command, context, mutationContext);
    },
  });

  return mutation;
}
