'use client';

import {
  MoveTaskSchema,
  ReorderTaskSchema,
  TaskMutationEnvelopeSchema,
} from '@flowboard/contracts';
import { useMutationState, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { moveTaskMutation, reorderTaskMutation } from '../../generated/apiHooks.gen';
import { apiError, ApiMutationError } from '../../lib/apiError';
import { useApiMutation } from '../../lib/useApiMutation';
import { useNotifications } from '../notifications/useNotifications';
import { isTaskBusy } from '../tasks/taskEvents';

import type { TaskPlacement } from './taskPlacement';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { MoveTaskResponse } from '@flowboard/api-client/types';
import type {
  MutationFunctionContext,
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query';

export type TaskPlacementMutationVariables = TaskPlacement;

export type TaskPlacementMutationData = MoveTaskResponse;

type TaskPlacementMutationContext = {
  report: ReturnType<ReturnType<typeof useNotifications>['capture']>;
};
export type TaskPlacementMutationOptions = Omit<
  UseMutationOptions<
    TaskPlacementMutationData,
    ApiMutationError,
    TaskPlacementMutationVariables,
    TaskPlacementMutationContext
  >,
  'mutationKey' | 'mutationFn' | 'retry' | 'networkMode' | 'onMutate'
>;

export type TaskPlacementMutationResult = UseMutationResult<
  TaskPlacementMutationData,
  ApiMutationError,
  TaskPlacementMutationVariables,
  TaskPlacementMutationContext
> & { pending: TaskPlacement[] };

export async function requestTaskPlacement(
  requestClient: ClientRuntime['client'],
  scope: QueryScope,
  command: TaskPlacementMutationVariables,

  mutationContext: MutationFunctionContext,
): Promise<TaskPlacementMutationData> {
  try {
    const body = MoveTaskSchema.required({ statusId: true }).parse(command.request);
    const path = { taskId: command.taskId };
    const isReorder =
      body.destinationListId === command.sourceListId &&
      body.statusId === command.sourceStatusId &&
      Object.keys(body.customFields ?? {}).length === 0;
    const response = isReorder
      ? await reorderTaskMutation({ client: requestClient }).mutationFn(
          {
            path,
            body: ReorderTaskSchema.parse({
              expectedVersion: body.expectedVersion,
              expectedConfigVersion: body.expectedConfigVersion,
              placement: body.placement,
            }),
          },
          mutationContext,
        )
      : await moveTaskMutation({ client: requestClient }).mutationFn(
          { path, body },
          mutationContext,
        );
    const parsed = TaskMutationEnvelopeSchema.parse(response);
    if (
      parsed.data.id !== command.taskId ||
      parsed.data.workspaceId !== scope.workspaceId ||
      parsed.data.primaryListId !== body.destinationListId ||
      parsed.data.statusId !== (body.statusId ?? command.sourceStatusId)
    )
      throw new Error('Invalid task mutation response');

    return parsed;
  } catch (cause) {
    throw new ApiMutationError(apiError(cause));
  }
}

export function useTaskPlacementMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  options: TaskPlacementMutationOptions = {},
): TaskPlacementMutationResult {
  const notifications = useNotifications();

  const capture = notifications.captureFactory();

  const client = useQueryClient();
  const [immediate, setImmediate] = useState<TaskPlacement[]>([]);

  const mutationKey = ['task-placement', scope.revision, scope.userId, scope.workspaceId];

  const mutation = useApiMutation<
    TaskPlacementMutationData,
    ApiMutationError,
    TaskPlacementMutationVariables,
    TaskPlacementMutationContext
  >({
    ...options,
    mutationKey,
    mutationFn: (command, mutationContext) =>
      requestTaskPlacement(runtime.client, scope, command, mutationContext),
    onMutate: (command) => {
      const report = capture();
      if (isTaskBusy(client, scope, command.taskId, true)) {
        throw new ApiMutationError({ code: 'BUSY', message: 'This task is already saving.' });
      }

      return { report };
    },
    onSuccess: async (response, command, context, mutationContext) => {
      context?.report(
        command.request.destinationListId === command.sourceListId &&
          command.request.statusId === command.sourceStatusId &&
          Object.keys(command.request.customFields ?? {}).length === 0
          ? 'Task reordered.'
          : 'Task moved.',
        'success',
      );
      await options.onSuccess?.(response, command, context, mutationContext);
    },
    onError: async (error, command, context, mutationContext) => {
      context?.report(error.message, 'error');
      await options.onError?.(error, command, context, mutationContext);
    },
    onSettled: async (response, error, command, context, mutationContext) => {
      setImmediate((current) => current.filter((item) => item !== command));
      await options.onSettled?.(response, error, command, context, mutationContext);
    },
  });
  const pending = useMutationState<TaskPlacement>({
    filters: { mutationKey, exact: true, status: 'pending' },
    select: (entry) => entry.state.variables as TaskPlacement,
  });

  return {
    ...mutation,
    pending: [
      ...pending.filter((command) => !immediate.some((item) => item.taskId === command.taskId)),
      ...immediate,
    ],
    mutate: (command, callOptions) => {
      setImmediate((current) => [...current, command]);
      mutation.mutate(command, callOptions);
    },
    mutateAsync: (command, callOptions) => {
      setImmediate((current) => [...current, command]);

      return mutation.mutateAsync(command, callOptions);
    },
  };
}
