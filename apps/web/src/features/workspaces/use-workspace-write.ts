'use client';

import {
  archiveWorkspaceMutation,
  getCurrentUserOptions,
  restoreWorkspaceMutation,
  updateWorkspaceMutation,
} from '@flowboard/api-client/tanstack-query';
import { useQueryClient } from '@tanstack/react-query';

import { useApiMutation } from '../../lib/useApiMutation';

import { apiError } from '../../lib/api-error';
import { withQueryScope } from '../../lib/query-scope';
import { configurationChanged } from '../config/configuration-events';
import { useNotifications } from '../notifications/notification-provider';

import { readWorkspaceWrite } from './workspace-lifecycle';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

type Command = { expectedConfigVersion: number; workspaceId: string } & (
  { kind: 'rename'; name: string } | { kind: 'archive' | 'restore' }
);
class WorkspaceResponseError extends Error {}

export function useWorkspaceWrite(runtime: ClientRuntime, scope: QueryScope) {
  const notifications = useNotifications();
  const client = useQueryClient();

  const rename = updateWorkspaceMutation({ client: runtime.client });
  const archive = archiveWorkspaceMutation({ client: runtime.client });
  const restore = restoreWorkspaceMutation({ client: runtime.client });

  const mutation = useApiMutation({
    mutationKey: ['configuration-write', scope.revision, scope.userId, scope.workspaceId],
    mutationFn: async (command: Command, context) => {
      const path = { workspaceId: command.workspaceId };
      const body = { expectedConfigVersion: command.expectedConfigVersion };
      const response =
        command.kind === 'rename'
          ? await rename.mutationFn!({ path, body: { ...body, name: command.name } }, context)
          : command.kind === 'archive'
            ? await archive.mutationFn!({ path, body }, context)
            : await restore.mutationFn!({ path, body }, context);
      const result = readWorkspaceWrite(response, command);
      if (!result)
        throw new WorkspaceResponseError(
          'The workspace response could not be validated. Reload before continuing.',
        );

      return result;
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
      if (command.kind === 'rename')
        await client.invalidateQueries({
          queryKey: withQueryScope(getCurrentUserOptions({ client: runtime.client }), scope)
            .queryKey,
        });

      report(
        {
          archive: 'Workspace archived.',
          rename: 'Workspace renamed.',
          restore: 'Workspace restored.',
        }[command.kind],
        'success',
      );

      return { success: true as const, response };
    } catch (cause) {
      const error =
        cause instanceof WorkspaceResponseError
          ? { code: 'INVALID_RESPONSE', message: cause.message }
          : apiError(cause);
      report(error.message, 'error');

      return { success: false as const, error };
    }
  };

  return { submit };
}
