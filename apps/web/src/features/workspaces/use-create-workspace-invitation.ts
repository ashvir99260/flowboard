'use client';

import { createWorkspaceInvitationMutation } from '@flowboard/api-client/tanstack-query';
import { CreateInvitationSchema } from '@flowboard/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiError } from '../../lib/api-error';
import { configurationChanged } from '../config/configuration-events';
import { useNotifications } from '../notifications/notification-provider';

import { readCreatedInvitation } from './invitation-data';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { CreateInvitation } from '@flowboard/contracts';

class InvitationResponseError extends Error {}

export function useCreateWorkspaceInvitation(runtime: ClientRuntime, scope: QueryScope) {
  const notifications = useNotifications();
  const client = useQueryClient();
  const generated = createWorkspaceInvitationMutation({ client: runtime.client });
  const mutation = useMutation({
    mutationKey: ['configuration-write', scope.revision, scope.userId, scope.workspaceId],
    retry: false,
    networkMode: 'always',
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
      const error = { code: 'BUSY', message: 'Another configuration change is saving.' };
      report(error.message, 'error');

      return { success: false as const, error };
    }

    try {
      const response = await mutation.mutateAsync(input);
      report('Invitation created. Share the private link with the recipient.', 'success');

      return { success: true as const, response };
    } catch (cause) {
      const error =
        cause instanceof InvitationResponseError
          ? { code: 'INVALID_RESPONSE', message: cause.message }
          : apiError(cause);
      report(error.message, 'error');

      return { success: false as const, error };
    }
  };

  return { submit };
}
