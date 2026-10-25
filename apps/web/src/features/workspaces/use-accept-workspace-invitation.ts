'use client';

import { acceptWorkspaceInvitationMutation } from '@flowboard/api-client/tanstack-query';
import { AcceptInvitationSchema, AcceptedInvitationEnvelopeSchema } from '@flowboard/contracts';
import { useQueryClient } from '@tanstack/react-query';

import { useApiMutation } from '../../lib/useApiMutation';

import { apiError } from '../../lib/api-error';
import { useNotifications } from '../notifications/notification-provider';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

class InvitationResponseError extends Error {}

export function useAcceptWorkspaceInvitation(runtime: ClientRuntime, scope: QueryScope) {
  const notifications = useNotifications();
  const client = useQueryClient();
  const generated = acceptWorkspaceInvitationMutation({ client: runtime.client });
  const mutation = useApiMutation({
    mutationKey: ['accept-invitation', scope.revision, scope.userId],
    mutationFn: async (token: string, context) => {
      const response = await generated.mutationFn!(
        { body: AcceptInvitationSchema.parse({ token }) },
        context,
      );
      const result = AcceptedInvitationEnvelopeSchema.safeParse(response);
      if (!result.success || result.data.data.archivedAt !== null)
        throw new InvitationResponseError(
          'The invitation result could not be validated. Open your workspace list to check membership.',
        );

      return result.data;
    },
  });

  const submit = async (token: string) => {
    const report = notifications.capture();
    try {
      const response = await mutation.mutateAsync(token);
      await client.invalidateQueries();
      report('Invitation accepted. You can now open the workspace.', 'success');

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
