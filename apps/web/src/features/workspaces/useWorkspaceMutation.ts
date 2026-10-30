'use client';

import { archiveWorkspace, restoreWorkspace, updateWorkspace } from '@flowboard/api-client/sdk';
import { getCurrentUserOptions } from '@flowboard/api-client/tanstack-query';
import { useQueryClient } from '@tanstack/react-query';

import { apiError, ApiMutationError } from '../../lib/apiError';
import { withQueryScope } from '../../lib/queryScope';
import { useApiMutation } from '../../lib/useApiMutation';
import { configurationChanged } from '../config/configurationEvents';
import { useNotifications } from '../notifications/useNotifications';

import { readWorkspaceWrite } from './workspaceLifecycle';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';

type Command = { expectedConfigVersion: number; workspaceId: string } & (
  { kind: 'rename'; name: string } | { kind: 'archive' | 'restore' }
);
class WorkspaceResponseError extends Error {}

export type WorkspaceMutationVariables = Command;

export type WorkspaceMutationData = NonNullable<ReturnType<typeof readWorkspaceWrite>>;

type WorkspaceMutationContext = {
  report: ReturnType<ReturnType<typeof useNotifications>['capture']>;
};
export type WorkspaceMutationOptions = Omit<
  UseMutationOptions<
    WorkspaceMutationData,
    ApiMutationError,
    WorkspaceMutationVariables,
    WorkspaceMutationContext
  >,
  'mutationKey' | 'mutationFn' | 'retry' | 'networkMode' | 'onMutate'
>;

export type WorkspaceMutationResult = UseMutationResult<
  WorkspaceMutationData,
  ApiMutationError,
  WorkspaceMutationVariables,
  WorkspaceMutationContext
>;

export async function requestWorkspace(
  requestClient: ClientRuntime['client'],
  scope: QueryScope,
  command: WorkspaceMutationVariables,
): Promise<WorkspaceMutationData> {
  try {
    const path = { workspaceId: command.workspaceId };
    const body = { expectedConfigVersion: command.expectedConfigVersion };
    const response =
      command.kind === 'rename'
        ? (
            await updateWorkspace({
              path,
              body: { ...body, name: command.name },
              client: requestClient,
              throwOnError: true,
            })
          ).data
        : command.kind === 'archive'
          ? (
              await archiveWorkspace({
                path,
                body,
                client: requestClient,
                throwOnError: true,
              })
            ).data
          : (
              await restoreWorkspace({
                path,
                body,
                client: requestClient,
                throwOnError: true,
              })
            ).data;
    const result = readWorkspaceWrite(response, command);
    if (!result)
      throw new WorkspaceResponseError(
        'The workspace response could not be validated. Reload before continuing.',
      );

    return result;
  } catch (cause) {
    throw new ApiMutationError(
      cause instanceof WorkspaceResponseError
        ? { code: 'INVALID_RESPONSE', message: cause.message }
        : apiError(cause),
    );
  }
}

export function useWorkspaceMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  options: WorkspaceMutationOptions = {},
): WorkspaceMutationResult {
  const notifications = useNotifications();

  const capture = notifications.captureFactory();

  const client = useQueryClient();

  const mutationKey = ['configuration-write', scope.revision, scope.userId, scope.workspaceId];

  const mutation = useApiMutation<
    WorkspaceMutationData,
    ApiMutationError,
    WorkspaceMutationVariables,
    WorkspaceMutationContext
  >({
    ...options,
    mutationKey,
    mutationFn: (command) => requestWorkspace(runtime.client, scope, command),
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
      if (command.kind === 'rename')
        await client.invalidateQueries({
          queryKey: withQueryScope(getCurrentUserOptions({ client: runtime.client }), scope)
            .queryKey,
        });

      context?.report(
        {
          archive: 'Workspace archived.',
          rename: 'Workspace renamed.',
          restore: 'Workspace restored.',
        }[command.kind],
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
