'use client';

import {
  createScopeStatusMutation,
  removeScopeStatusMutation,
  updateScopeStatusMutation,
} from '@flowboard/api-client/tanstack-query';
import { useQueryClient } from '@tanstack/react-query';

import { apiError } from '../../../lib/apiError';
import { useApiMutation } from '../../../lib/useApiMutation';
import { useNotifications } from '../../notifications/useNotifications';
import { configurationChanged } from '../configurationEvents';

import { readStatusWriteResponse } from './statusWriteData';

import type { statusCommand } from './statusFormData';
import type { QueryScope } from '../../../lib/queryScope';
import type { ClientRuntime } from '../../../providers/sessionContext';
import type { StatusScope } from '@flowboard/contracts';

type Command =
  | NonNullable<ReturnType<typeof statusCommand>>
  | { body: { expectedConfigVersion: number }; kind: 'remove'; statusId: string };
class InvalidStatusResponse extends Error {}

export function useStatusMutation(runtime: ClientRuntime, scope: QueryScope, owner: StatusScope) {
  const notifications = useNotifications();
  const client = useQueryClient();

  const create = createScopeStatusMutation({ client: runtime.client });
  const update = updateScopeStatusMutation({ client: runtime.client });
  const remove = removeScopeStatusMutation({ client: runtime.client });

  const mutation = useApiMutation({
    mutationKey: ['configuration-write', scope.revision, scope.userId, scope.workspaceId],
    mutationFn: async (command: Command, context) => {
      if (command.kind === 'remove') {
        await remove.mutationFn!(
          { path: { ...owner, statusId: command.statusId }, body: command.body },
          context,
        );

        return null;
      }

      const response =
        command.kind === 'create'
          ? await create.mutationFn!({ path: owner, body: command.body }, context)
          : await update.mutationFn!(
              { path: { ...owner, statusId: command.statusId }, body: command.body },
              context,
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
    },
  });

  const submit = async (command: Command) => {
    const report = notifications.capture();
    if (
      client.isMutating({
        predicate: (entry) => configurationChanged(entry.options.mutationKey, 'success', scope),
      })
    )
      return {
        success: false as const,
        error: { code: 'BUSY', message: 'Another configuration change is saving.' },
      };

    try {
      const response = await mutation.mutateAsync(command);
      report(
        { create: 'Status created.', remove: 'Status removed.', update: 'Status saved.' }[
          command.kind
        ],
        'success',
      );

      return { success: true as const, response };
    } catch (error) {
      const failure: ReturnType<typeof apiError> =
        error instanceof InvalidStatusResponse
          ? { code: 'INVALID_RESPONSE', message: error.message }
          : apiError(error);
      report(failure.message, 'error');

      return { success: false as const, error: failure };
    }
  };

  return { submit };
}
