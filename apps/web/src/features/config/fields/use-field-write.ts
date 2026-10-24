'use client';

import {
  createScopeFieldMutation,
  removeScopeFieldMutation,
  updateScopeFieldMutation,
} from '@flowboard/api-client/tanstack-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiError } from '../../../lib/api-error';
import { useNotifications } from '../../notifications/notification-provider';
import { configurationChanged } from '../configuration-events';

import { readFieldWriteResponse } from './field-write-data';

import type { fieldCommand } from './field-form-data';
import type { QueryScope } from '../../../lib/query-scope';
import type { ClientRuntime } from '../../../providers/app-providers';
import type { FieldScope } from '@flowboard/contracts';

type Command =
  | NonNullable<ReturnType<typeof fieldCommand>>
  | { body: { expectedConfigVersion: number }; fieldId: string; kind: 'remove' };
class InvalidFieldResponse extends Error {}

export function useFieldWrite(runtime: ClientRuntime, scope: QueryScope, owner: FieldScope) {
  const notifications = useNotifications();
  const client = useQueryClient();
  const create = createScopeFieldMutation({ client: runtime.client });
  const update = updateScopeFieldMutation({ client: runtime.client });
  const remove = removeScopeFieldMutation({ client: runtime.client });
  const mutation = useMutation({
    mutationKey: ['configuration-write', scope.revision, scope.userId, scope.workspaceId],
    retry: false,
    networkMode: 'always',
    mutationFn: async (command: Command, context) => {
      if (command.kind === 'remove') {
        await remove.mutationFn!(
          { path: { ...owner, fieldId: command.fieldId }, body: command.body },
          context,
        );

        return null;
      }

      const response =
        command.kind === 'create'
          ? await create.mutationFn!({ path: owner, body: command.body }, context)
          : await update.mutationFn!(
              { path: { ...owner, fieldId: command.fieldId }, body: command.body },
              context,
            );
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
        { create: 'Field created.', remove: 'Field removed.', update: 'Field saved.' }[
          command.kind
        ],
        'success',
      );

      return { success: true as const, response };
    } catch (error) {
      const failure: ReturnType<typeof apiError> =
        error instanceof InvalidFieldResponse
          ? { code: 'INVALID_RESPONSE', message: error.message }
          : apiError(error);
      report(failure.message, 'error');

      return { success: false as const, error: failure };
    }
  };

  return { submit };
}
