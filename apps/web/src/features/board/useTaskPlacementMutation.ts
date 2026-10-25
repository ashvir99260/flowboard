'use client';

import { moveTaskMutation, reorderTaskMutation } from '@flowboard/api-client/tanstack-query';
import {
  MoveTaskSchema,
  ReorderTaskSchema,
  TaskMutationEnvelopeSchema,
} from '@flowboard/contracts';
import { useMutationState, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { apiError } from '../../lib/apiError';
import { useApiMutation } from '../../lib/useApiMutation';
import { useNotifications } from '../notifications/useNotifications';
import { isTaskBusy } from '../tasks/taskEvents';

import type { TaskPlacement } from './taskPlacement';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { MoveTaskResponse } from '@flowboard/api-client/types';

export function useTaskPlacementMutation(runtime: ClientRuntime, scope: QueryScope) {
  const notifications = useNotifications();
  const client = useQueryClient();
  const [immediate, setImmediate] = useState<TaskPlacement[]>([]);

  const mutationKey = ['task-placement', scope.revision, scope.userId, scope.workspaceId];

  const move = moveTaskMutation({ client: runtime.client });
  const reorder = reorderTaskMutation({ client: runtime.client });

  const mutation = useApiMutation<MoveTaskResponse, unknown, TaskPlacement>({
    mutationKey,
    mutationFn: async (command, context) => {
      const body = MoveTaskSchema.required({ statusId: true }).parse(command.request);
      const path = { taskId: command.taskId };
      const isReorder =
        body.destinationListId === command.sourceListId &&
        body.statusId === command.sourceStatusId &&
        Object.keys(body.customFields ?? {}).length === 0;
      const response = isReorder
        ? await reorder.mutationFn!(
            {
              path,
              body: ReorderTaskSchema.parse({
                expectedVersion: body.expectedVersion,
                expectedConfigVersion: body.expectedConfigVersion,
                placement: body.placement,
              }),
            },
            context,
          )
        : await move.mutationFn!({ path, body }, context);
      const parsed = TaskMutationEnvelopeSchema.parse(response);
      if (
        parsed.data.id !== command.taskId ||
        parsed.data.workspaceId !== scope.workspaceId ||
        parsed.data.primaryListId !== body.destinationListId ||
        parsed.data.statusId !== (body.statusId ?? command.sourceStatusId)
      )
        throw new Error('Invalid task mutation response');

      return parsed;
    },
  });
  const pending = useMutationState<TaskPlacement>({
    filters: { mutationKey, exact: true, status: 'pending' },
    select: (entry) => entry.state.variables as TaskPlacement,
  });

  const submit = async (command: TaskPlacement) => {
    const report = notifications.capture();
    if (isTaskBusy(client, scope, command.taskId))
      return {
        success: false as const,
        error: { code: 'BUSY', message: 'This task is already saving.' },
      };

    // DnD needs its projection in the drop render, before cache subscribers are notified.
    setImmediate((current) => [...current, command]);
    try {
      await mutation.mutateAsync(command);
      report(
        command.request.destinationListId === command.sourceListId &&
          command.request.statusId === command.sourceStatusId &&
          Object.keys(command.request.customFields ?? {}).length === 0
          ? 'Task reordered.'
          : 'Task moved.',
        'success',
      );

      return { success: true as const };
    } catch (failure) {
      const error = apiError(failure);
      report(error.message, 'error');

      return { success: false as const, error };
    } finally {
      setImmediate((current) => current.filter((item) => item !== command));
    }
  };

  return {
    pending: [
      ...pending.filter((command) => !immediate.some((item) => item.taskId === command.taskId)),
      ...immediate,
    ],
    submit,
  };
}
