'use client';

import {
  CreateNodeSchema,
  MoveNodeSchema,
  NodeVersionSchema,
  ReorderNodeSchema,
  UpdateNodeSchema,
  UpsertGrantSchema,
} from '@flowboard/contracts';
import { useQueryClient } from '@tanstack/react-query';

import {
  archiveNodeMutation,
  createNodeMutation,
  moveNodeMutation,
  removeNodeGrantMutation,
  reorderNodeMutation,
  updateNodeMutation,
  upsertNodeGrantMutation,
} from '../../generated/apiHooks.gen';
import { apiError, ApiMutationError } from '../../lib/apiError';
import { useApiMutation } from '../../lib/useApiMutation';
import { configurationChanged } from '../config/configurationEvents';
import { useNotifications } from '../notifications/useNotifications';

import { readContainerWrite, readGrantWrite } from './administrationData';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type {
  CreateNode,
  MoveNode,
  NodeVersion,
  ReorderNode,
  UpdateNode,
  UpsertGrant,
} from '@flowboard/contracts';
import type {
  MutationFunctionContext,
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query';

export type AdministrationCommand =
  | { body: CreateNode; kind: 'create' }
  | { body: UpdateNode; kind: 'update'; nodeId: string }
  | { body: MoveNode; kind: 'move'; nodeId: string }
  | { body: ReorderNode; kind: 'reorder'; nodeId: string }
  | { body: NodeVersion; kind: 'archive'; nodeId: string }
  | { body: UpsertGrant; kind: 'grant'; nodeId: string }
  | {
      body: { expectedConfigVersion: number };
      kind: 'removeGrant';
      nodeId: string;
      userId: string;
    };

class InvalidAdministrationResponse extends Error {}

export type AdministrationMutationVariables = AdministrationCommand;

export type AdministrationMutationData = NonNullable<ReturnType<typeof readContainerWrite>> | null;

type AdministrationMutationContext = {
  report: ReturnType<ReturnType<typeof useNotifications>['capture']>;
};
export type AdministrationMutationOptions = Omit<
  UseMutationOptions<
    AdministrationMutationData,
    ApiMutationError,
    AdministrationMutationVariables,
    AdministrationMutationContext
  >,
  'mutationKey' | 'mutationFn' | 'retry' | 'networkMode' | 'onMutate'
>;

export type AdministrationMutationResult = UseMutationResult<
  AdministrationMutationData,
  ApiMutationError,
  AdministrationMutationVariables,
  AdministrationMutationContext
>;

export async function requestAdministration(
  requestClient: ClientRuntime['client'],
  scope: QueryScope,
  command: AdministrationMutationVariables,

  mutationContext: MutationFunctionContext,
): Promise<AdministrationMutationData> {
  try {
    if (command.kind === 'archive') {
      await archiveNodeMutation({ client: requestClient }).mutationFn(
        { ...{ path: { nodeId: command.nodeId }, body: NodeVersionSchema.parse(command.body) } },
        mutationContext,
      );

      return null;
    }

    if (command.kind === 'removeGrant') {
      await removeNodeGrantMutation({ client: requestClient }).mutationFn(
        { ...{ path: { nodeId: command.nodeId, userId: command.userId }, body: command.body } },
        mutationContext,
      );

      return null;
    }

    if (command.kind === 'grant') {
      const response = await upsertNodeGrantMutation({ client: requestClient }).mutationFn(
        { path: { nodeId: command.nodeId }, body: UpsertGrantSchema.parse(command.body) },
        mutationContext,
      );
      const parsed = readGrantWrite(response, {
        nodeId: command.nodeId,
        ...command.body,
        configVersion: command.body.expectedConfigVersion,
      });
      if (!parsed)
        throw new InvalidAdministrationResponse(
          'Grant response could not be verified. Reload before continuing.',
        );

      return null;
    }

    const response =
      command.kind === 'create'
        ? await createNodeMutation({ client: requestClient }).mutationFn(
            { body: CreateNodeSchema.parse(command.body) },
            mutationContext,
          )
        : command.kind === 'update'
          ? await updateNodeMutation({ client: requestClient }).mutationFn(
              { path: { nodeId: command.nodeId }, body: UpdateNodeSchema.parse(command.body) },
              mutationContext,
            )
          : command.kind === 'move'
            ? await moveNodeMutation({ client: requestClient }).mutationFn(
                { path: { nodeId: command.nodeId }, body: MoveNodeSchema.parse(command.body) },
                mutationContext,
              )
            : await reorderNodeMutation({ client: requestClient }).mutationFn(
                { path: { nodeId: command.nodeId }, body: ReorderNodeSchema.parse(command.body) },
                mutationContext,
              );
    const parsed = readContainerWrite(response, {
      workspaceId: scope.workspaceId!,
      ...('nodeId' in command ? { nodeId: command.nodeId } : {}),
    });
    if (
      !parsed ||
      parsed.configVersion < command.body.expectedConfigVersion ||
      parsed.configVersion > command.body.expectedConfigVersion + 1 ||
      (command.kind !== 'create' && parsed.data.version < command.body.expectedVersion)
    )
      throw new InvalidAdministrationResponse(
        'Container response could not be verified. Reload before continuing.',
      );

    if (
      (command.kind === 'create' &&
        (parsed.data.type !== command.body.type ||
          parsed.data.parentId !== command.body.parentId ||
          parsed.data.name !== command.body.name ||
          parsed.data.visibility !== command.body.visibility)) ||
      (command.kind === 'move' && parsed.data.parentId !== command.body.parentId) ||
      (command.kind === 'update' &&
        ((command.body.name !== undefined && parsed.data.name !== command.body.name) ||
          (command.body.visibility !== undefined &&
            parsed.data.visibility !== command.body.visibility)))
    )
      throw new InvalidAdministrationResponse(
        'Saved container does not match the requested change. Reload before continuing.',
      );

    return parsed;
  } catch (cause) {
    throw new ApiMutationError(
      cause instanceof InvalidAdministrationResponse
        ? { code: 'INVALID_RESPONSE', message: cause.message }
        : apiError(cause),
    );
  }
}

export function useAdministrationMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  options: AdministrationMutationOptions = {},
): AdministrationMutationResult {
  const notifications = useNotifications();

  const capture = notifications.captureFactory();

  const client = useQueryClient();

  const mutationKey = ['configuration-write', scope.revision, scope.userId, scope.workspaceId];

  const mutation = useApiMutation<
    AdministrationMutationData,
    ApiMutationError,
    AdministrationMutationVariables,
    AdministrationMutationContext
  >({
    ...options,
    mutationKey,
    mutationFn: (command, mutationContext) =>
      requestAdministration(runtime.client, scope, command, mutationContext),
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
      const tag = `flowboard:${JSON.stringify({ revision: scope.revision, userId: scope.userId, workspaceId: scope.workspaceId })}`;
      void client.resetQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as { _id?: string; tags?: readonly string[] } | undefined;

          return Boolean(
            key &&
            ['listVisibleTree', 'getNode'].includes(key._id ?? '') &&
            key.tags?.includes(tag),
          );
        },
      });
      context?.report(
        {
          archive: 'Container archived.',
          create: 'Container created.',
          grant: 'Access saved.',
          move: 'Container moved.',
          removeGrant: 'Explicit grant removed.',
          reorder: 'Container reordered.',
          update: 'Container saved.',
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
