'use client';

import {
  createScopeStatusMutation,
  removeScopeStatusMutation,
  updateScopeStatusMutation,
} from '@flowboard/api-client/tanstack-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiError } from '../../../lib/api-error';
import { configurationChanged } from '../configuration-events';

import { readStatusWriteResponse } from './status-write-data';

import type { statusCommand } from './status-form-data';
import type { QueryScope } from '../../../lib/query-scope';
import type { ClientRuntime } from '../../../providers/app-providers';
import type { StatusScope } from '@flowboard/contracts';

type Command =
  | NonNullable<ReturnType<typeof statusCommand>>
  | { body: { expectedConfigVersion: number }; kind: 'remove'; statusId: string };
class InvalidStatusResponse extends Error {}

export function useStatusWrite(runtime: ClientRuntime, scope: QueryScope, owner: StatusScope) {
  const client = useQueryClient();
  const create = createScopeStatusMutation({ client: runtime.client });
  const update = updateScopeStatusMutation({ client: runtime.client });
  const remove = removeScopeStatusMutation({ client: runtime.client });
  const mutation = useMutation({
    mutationKey: ['configuration-write', scope.revision, scope.userId, scope.workspaceId],
    retry: false,
    networkMode: 'always',
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
      return { success: true as const, response: await mutation.mutateAsync(command) };
    } catch (error) {
      if (error instanceof InvalidStatusResponse)
        return {
          success: false as const,
          error: { code: 'INVALID_RESPONSE', message: error.message },
        };

      return { success: false as const, error: apiError(error) };
    }
  };

  return { submit };
}
