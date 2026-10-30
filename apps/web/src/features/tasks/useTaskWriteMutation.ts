'use client';

import { archiveTask, createTask, updateTask } from '@flowboard/api-client/sdk';
import { ArchiveTaskSchema, CreateTaskSchema, UpdateTaskSchema } from '@flowboard/contracts';
import { useQueryClient } from '@tanstack/react-query';

import { apiError, ApiMutationError } from '../../lib/apiError';
import { useApiMutation } from '../../lib/useApiMutation';
import { useNotifications } from '../notifications/useNotifications';

import { isTaskBusy } from './taskEvents';
import { readTaskWriteResponse } from './taskWriteData';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type {
  ArchiveTask,
  CreateTask,
  ResolvedField,
  ResolvedStatus,
  UpdateTask,
} from '@flowboard/contracts';
import type { UseMutationOptions, UseMutationResult } from '@tanstack/react-query';

class TaskResponseError extends Error {}

type TaskWrite = { listId: string; taskId: string } & (
  | { body: CreateTask; kind: 'create' }
  | { body: UpdateTask; kind: 'update' }
  | { body: ArchiveTask; kind: 'archive' }
);

export type TaskWriteMutationVariables = TaskWrite;

export type TaskWriteMutationData =
  Extract<ReturnType<typeof readTaskWriteResponse>, { success: true }>['response'] | null;

type TaskWriteMutationContext = {
  report: ReturnType<ReturnType<typeof useNotifications>['capture']>;
};
export type TaskWriteMutationOptions = Omit<
  UseMutationOptions<
    TaskWriteMutationData,
    ApiMutationError,
    TaskWriteMutationVariables,
    TaskWriteMutationContext
  >,
  'mutationKey' | 'mutationFn' | 'retry' | 'networkMode' | 'onMutate'
>;

export type TaskWriteMutationResult = UseMutationResult<
  TaskWriteMutationData,
  ApiMutationError,
  TaskWriteMutationVariables,
  TaskWriteMutationContext
>;

export async function requestTaskWrite(
  requestClient: ClientRuntime['client'],
  scope: QueryScope,
  configuration: { fields: readonly ResolvedField[]; statuses: readonly ResolvedStatus[] },
  command: TaskWriteMutationVariables,
): Promise<TaskWriteMutationData> {
  try {
    if (command.kind === 'archive') {
      await archiveTask({
        ...{ path: { taskId: command.taskId }, body: ArchiveTaskSchema.parse(command.body) },
        client: requestClient,
        throwOnError: true,
      });

      return null;
    }

    const response =
      command.kind === 'create'
        ? (
            await createTask({
              path: { listId: command.listId },
              body: CreateTaskSchema.parse(command.body),
              client: requestClient,
              throwOnError: true,
            })
          ).data
        : (
            await updateTask({
              path: { taskId: command.taskId },
              body: UpdateTaskSchema.parse(command.body),
              client: requestClient,
              throwOnError: true,
            })
          ).data;
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
  } catch (cause) {
    throw new ApiMutationError(
      cause instanceof TaskResponseError
        ? { code: 'INVALID_RESPONSE', message: cause.message }
        : apiError(cause),
    );
  }
}

export function useTaskWriteMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  configuration: { fields: readonly ResolvedField[]; statuses: readonly ResolvedStatus[] },
  options: TaskWriteMutationOptions = {},
): TaskWriteMutationResult {
  const notifications = useNotifications();

  const capture = notifications.captureFactory();

  const client = useQueryClient();

  const mutationKey = ['task-write', scope.revision, scope.userId, scope.workspaceId];

  const mutation = useApiMutation<
    TaskWriteMutationData,
    ApiMutationError,
    TaskWriteMutationVariables,
    TaskWriteMutationContext
  >({
    ...options,
    mutationKey,
    mutationFn: (command) => requestTaskWrite(runtime.client, scope, configuration, command),
    onMutate: (command) => {
      const report = capture();
      if (isTaskBusy(client, scope, command.taskId, true)) {
        throw new ApiMutationError({ code: 'BUSY', message: 'This task is already saving.' });
      }

      return { report };
    },
    onSuccess: async (response, command, context, mutationContext) => {
      context?.report(
        { archive: 'Task archived.', create: 'Task created.', update: 'Task saved.' }[command.kind],
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
