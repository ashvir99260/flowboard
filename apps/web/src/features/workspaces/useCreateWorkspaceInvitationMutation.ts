'use client';

import { createWorkspaceInvitationMutation } from '@flowboard/api-client/tanstack-query';
import { CreateInvitationSchema } from '@flowboard/contracts';
import { useQueryClient } from '@tanstack/react-query';

import { apiError } from '../../lib/apiError';
import { useApiMutation } from '../../lib/useApiMutation';
import { configurationChanged } from '../config/configurationEvents';
import { useNotifications } from '../notifications/useNotifications';

import { readCreatedInvitation } from './invitationData';

import type { CreateInvitation } from '@flowboard/contracts';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

class InvitationResponseError extends Error {}

export function useCreateWorkspaceInvitationMutation(runtime: ClientRuntime, scope: QueryScope) {
  const notifications = useNotifications();
  const client = useQueryClient();
  const generated = createWorkspaceInvitationMutation({ client: runtime.client });
  const mutation = useApiMutation({
    mutationKey: ['configuration-write', scope.revision, scope.userId, scope.workspaceId],
    mutationFn: async (input: CreateInvitation, context) => {
      const body = CreateInvitationSchema.parse(input);
      const response = await generated.mutationFn!(
        { path: { workspaceId: scope.workspaceId! }, body },
        context,
      );
      const parsed = readCreatedInvitation(response, body.expectedConfigVersion);
      if (!parsed)
        throw new InvitationResponseError(
          'The invitation response could not be validated. Reload before creating another invitation.',
        );

      return parsed;
    },
  });

  const submit = async (input: CreateInvitation) => {
    const report = notifications.capture();
    if (
      client.isMutating({
        predicate: (entry) => configurationChanged(entry.options.mutationKey, 'success', scope),
      })
    ) {
      const error: ReturnType<typeof apiError> = {
        code: 'BUSY',
        message: 'Another configuration change is saving.',
      };
      report(error.message, 'error');

      return { success: false as const, error };
    }

    try {
      const response = await mutation.mutateAsync(input);
      report('Invitation created. Share the private link with the recipient.', 'success');

      return { success: true as const, response };
    } catch (cause) {
      const error: ReturnType<typeof apiError> =
        cause instanceof InvitationResponseError
          ? { code: 'INVALID_RESPONSE', message: cause.message }
          : apiError(cause);
      report(error.message, 'error');

      return { success: false as const, error };
    }
  };

  return { submit };
}
