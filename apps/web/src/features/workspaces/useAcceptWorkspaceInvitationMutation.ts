'use client';

import { acceptWorkspaceInvitation } from '@flowboard/api-client/sdk';
import { AcceptedInvitationEnvelopeSchema, AcceptInvitationSchema } from '@flowboard/contracts';
import { useQueryClient } from '@tanstack/react-query';

import { apiError, ApiMutationError } from '../../lib/apiError';
import { useApiMutation } from '../../lib/useApiMutation';
import { useNotifications } from '../notifications/useNotifications';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';

class InvitationResponseError extends Error {}

export type AcceptWorkspaceInvitationMutationVariables = string;

export type AcceptWorkspaceInvitationMutationData = ReturnType<
  typeof AcceptedInvitationEnvelopeSchema.parse
>;

type AcceptWorkspaceInvitationMutationContext = {
  report: ReturnType<ReturnType<typeof useNotifications>['capture']>;
};
export type AcceptWorkspaceInvitationMutationOptions = Omit<
  UseMutationOptions<
    AcceptWorkspaceInvitationMutationData,
    ApiMutationError,
    AcceptWorkspaceInvitationMutationVariables,
    AcceptWorkspaceInvitationMutationContext
  >,
  'mutationKey' | 'mutationFn' | 'retry' | 'networkMode' | 'onMutate'
>;

export type AcceptWorkspaceInvitationMutationResult = UseMutationResult<
  AcceptWorkspaceInvitationMutationData,
  ApiMutationError,
  AcceptWorkspaceInvitationMutationVariables,
  AcceptWorkspaceInvitationMutationContext
>;

export async function requestAcceptWorkspaceInvitation(
  requestClient: ClientRuntime['client'],
  command: AcceptWorkspaceInvitationMutationVariables,
): Promise<AcceptWorkspaceInvitationMutationData> {
  try {
    const response = (
      await acceptWorkspaceInvitation({
        body: AcceptInvitationSchema.parse({ token: command }),
        client: requestClient,
        throwOnError: true,
      })
    ).data;
    const result = AcceptedInvitationEnvelopeSchema.safeParse(response);
    if (!result.success || result.data.data.archivedAt !== null)
      throw new InvitationResponseError(
        'The invitation result could not be validated. Open your workspace list to check membership.',
      );

    return result.data;
  } catch (cause) {
    throw new ApiMutationError(
      cause instanceof InvitationResponseError
        ? { code: 'INVALID_RESPONSE', message: cause.message }
        : apiError(cause),
    );
  }
}

export function useAcceptWorkspaceInvitationMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  options: AcceptWorkspaceInvitationMutationOptions = {},
): AcceptWorkspaceInvitationMutationResult {
  const notifications = useNotifications();

  const capture = notifications.captureFactory();

  const client = useQueryClient();

  const mutationKey = ['accept-invitation', scope.revision, scope.userId];

  const mutation = useApiMutation<
    AcceptWorkspaceInvitationMutationData,
    ApiMutationError,
    AcceptWorkspaceInvitationMutationVariables,
    AcceptWorkspaceInvitationMutationContext
  >({
    ...options,
    mutationKey,
    mutationFn: (command) => requestAcceptWorkspaceInvitation(runtime.client, command),
    onMutate: () => {
      const report = capture();

      return { report };
    },
    onSuccess: async (response, command, context, mutationContext) => {
      await client.invalidateQueries();
      context?.report('Invitation accepted. You can now open the workspace.', 'success');
      await options.onSuccess?.(response, command, context, mutationContext);
    },
    onError: async (error, command, context, mutationContext) => {
      context?.report(error.message, 'error');
      await options.onError?.(error, command, context, mutationContext);
    },
  });

  return mutation;
}
