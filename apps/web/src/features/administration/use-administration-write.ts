'use client';

import {
  archiveNodeMutation,
  createNodeMutation,
  moveNodeMutation,
  removeNodeGrantMutation,
  reorderNodeMutation,
  updateNodeMutation,
  upsertNodeGrantMutation,
} from '@flowboard/api-client/tanstack-query';
import {
  CreateNodeSchema,
  MoveNodeSchema,
  NodeVersionSchema,
  ReorderNodeSchema,
  UpdateNodeSchema,
  UpsertGrantSchema,
} from '@flowboard/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { apiError } from '../../lib/api-error';
import { configurationChanged } from '../config/configuration-events';
import { useNotifications } from '../notifications/notification-provider';

import { readContainerWrite, readGrantWrite } from './administration-data';

import type {
  CreateNode,
  MoveNode,
  NodeVersion,
  ReorderNode,
  UpdateNode,
  UpsertGrant,
} from '@flowboard/contracts';
import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';

export type AdministrationCommand =
  | { kind: 'create'; body: CreateNode }
  | { kind: 'update'; nodeId: string; body: UpdateNode }
  | { kind: 'move'; nodeId: string; body: MoveNode }
  | { kind: 'reorder'; nodeId: string; body: ReorderNode }
  | { kind: 'archive'; nodeId: string; body: NodeVersion }
  | { kind: 'grant'; nodeId: string; body: UpsertGrant }
  | {
      kind: 'removeGrant';
      nodeId: string;
      userId: string;
      body: { expectedConfigVersion: number };
    };

class InvalidAdministrationResponse extends Error {}

export function useAdministrationWrite(runtime: ClientRuntime, scope: QueryScope) {
  const client = useQueryClient();
  const notifications = useNotifications();
  const create = createNodeMutation({ client: runtime.client });
  const update = updateNodeMutation({ client: runtime.client });
  const move = moveNodeMutation({ client: runtime.client });
  const reorder = reorderNodeMutation({ client: runtime.client });
  const archive = archiveNodeMutation({ client: runtime.client });
  const grant = upsertNodeGrantMutation({ client: runtime.client });
  const removeGrant = removeNodeGrantMutation({ client: runtime.client });
  const mutation = useMutation({
    mutationKey: ['configuration-write', scope.revision, scope.userId, scope.workspaceId],
    retry: false,
    networkMode: 'always',
    mutationFn: async (command: AdministrationCommand, context) => {
      if (command.kind === 'archive') {
        await archive.mutationFn!(
          { path: { nodeId: command.nodeId }, body: NodeVersionSchema.parse(command.body) },
          context,
        );

        return null;
      }

      if (command.kind === 'removeGrant') {
        await removeGrant.mutationFn!(
          { path: { nodeId: command.nodeId, userId: command.userId }, body: command.body },
          context,
        );

        return null;
      }

      if (command.kind === 'grant') {
        const response = await grant.mutationFn!(
          { path: { nodeId: command.nodeId }, body: UpsertGrantSchema.parse(command.body) },
          context,
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
          ? await create.mutationFn!({ body: CreateNodeSchema.parse(command.body) }, context)
          : command.kind === 'update'
            ? await update.mutationFn!(
                { path: { nodeId: command.nodeId }, body: UpdateNodeSchema.parse(command.body) },
                context,
              )
            : command.kind === 'move'
              ? await move.mutationFn!(
                  { path: { nodeId: command.nodeId }, body: MoveNodeSchema.parse(command.body) },
                  context,
                )
              : await reorder.mutationFn!(
                  { path: { nodeId: command.nodeId }, body: ReorderNodeSchema.parse(command.body) },
                  context,
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
    },
  });

  const submit = async (command: AdministrationCommand) => {
    if (
      client.isMutating({
        predicate: (entry) => configurationChanged(entry.options.mutationKey, 'success', scope),
      })
    )
      return {
        success: false as const,
        error: { code: 'BUSY', message: 'Another configuration change is saving.' },
      };

    const report = notifications.capture();
    try {
      const response = await mutation.mutateAsync(command);
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
      report(
        {
          create: 'Container created.',
          update: 'Container saved.',
          move: 'Container moved.',
          reorder: 'Container reordered.',
          archive: 'Container archived.',
          grant: 'Access saved.',
          removeGrant: 'Explicit grant removed.',
        }[command.kind],
        'success',
      );

      return { success: true as const, response };
    } catch (cause) {
      const error =
        cause instanceof InvalidAdministrationResponse
          ? { code: 'INVALID_RESPONSE', message: cause.message }
          : apiError(cause);
      report(error.message, 'error');

      return { success: false as const, error };
    }
  };

  return { submit };
}
