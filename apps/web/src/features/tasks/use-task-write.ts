'use client';

import {
  archiveTaskMutation,
  createTaskMutation,
  updateTaskMutation,
} from '@flowboard/api-client/tanstack-query';
import { ArchiveTaskSchema, CreateTaskSchema, UpdateTaskSchema } from '@flowboard/contracts';
import { useQueryClient } from '@tanstack/react-query';

import { useApiMutation } from '../../lib/useApiMutation';

import { apiError } from '../../lib/api-error';
import { useNotifications } from '../notifications/notification-provider';

import { isTaskBusy } from './task-events';
import { readTaskWriteResponse } from './task-write-data';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type {
  ArchiveTask,
  CreateTask,
  ResolvedField,
  ResolvedStatus,
  UpdateTask,
} from '@flowboard/contracts';

class TaskResponseError extends Error {}

type TaskWrite = { listId: string; taskId: string } & (
  | { body: CreateTask; kind: 'create' }
  | { body: UpdateTask; kind: 'update' }
  | { body: ArchiveTask; kind: 'archive' }
);

export function useTaskWrite(
  runtime: ClientRuntime,
  scope: QueryScope,
  configuration: { fields: readonly ResolvedField[]; statuses: readonly ResolvedStatus[] },
) {
  const notifications = useNotifications();
  const client = useQueryClient();

  const create = createTaskMutation({ client: runtime.client });
  const update = updateTaskMutation({ client: runtime.client });
  const archive = archiveTaskMutation({ client: runtime.client });

  const mutation = useApiMutation({
    mutationKey: ['task-write', scope.revision, scope.userId, scope.workspaceId],
    mutationFn: async (command: TaskWrite, context) => {
      if (command.kind === 'archive') {
        await archive.mutationFn!(
          { path: { taskId: command.taskId }, body: ArchiveTaskSchema.parse(command.body) },
          context,
        );

        return null;
      }

      const response =
        command.kind === 'create'
          ? await create.mutationFn!(
              { path: { listId: command.listId }, body: CreateTaskSchema.parse(command.body) },
              context,
            )
          : await update.mutationFn!(
              { path: { taskId: command.taskId }, body: UpdateTaskSchema.parse(command.body) },
              context,
            );
      const parsed = readTaskWriteResponse(response, {
        ...configuration,
        workspaceId: scope.workspaceId,
        listId: command.listId,
        taskId: command.kind === 'update' ? command.taskId : undefined,
        configVersion: command.body.expectedConfigVersion,
        minVersion: command.kind === 'update' ? command.body.expectedVersion : 1,
      });
      if (!parsed.success)
        throw new TaskResponseError(
          'The saved task response could not be validated. Reload before continuing.',
        );

      return parsed.response;
    },
  });

  const submit = async (command: TaskWrite) => {
    const report = notifications.capture();
    if (isTaskBusy(client, scope, command.taskId))
      return {
        success: false as const,
        error: { code: 'BUSY', message: 'This task is already saving.' },
      };

    try {
      const response = await mutation.mutateAsync(command);
      report(
        { archive: 'Task archived.', create: 'Task created.', update: 'Task saved.' }[command.kind],
        'success',
      );

      return { success: true as const, response };
    } catch (error) {
      const failure: ReturnType<typeof apiError> =
        error instanceof TaskResponseError
          ? { code: 'INVALID_RESPONSE', message: error.message }
          : apiError(error);
      report(failure.message, 'error');

      return { success: false as const, error: failure };
    }
  };

  return { submit };
}
