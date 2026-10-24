'use client';

import { moveTaskMutation, reorderTaskMutation } from '@flowboard/api-client/tanstack-query';
import {
  MoveTaskSchema,
  ReorderTaskSchema,
  TaskMutationEnvelopeSchema,
} from '@flowboard/contracts';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { apiError } from '../../lib/api-error';
import { useNotifications } from '../notifications/notification-provider';
import { isTaskBusy } from '../tasks/task-events';

import type { TaskPlacement } from './task-placement';
import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { MoveTaskResponse } from '@flowboard/api-client/types';

export function useTaskMutation(runtime: ClientRuntime, scope: QueryScope) {
  const notifications = useNotifications();
  const client = useQueryClient();
  const mutationKey = ['task-placement', scope.revision, scope.userId, scope.workspaceId];
  const [notice, setNotice] = useState<string | null>(null);
  const move = moveTaskMutation({ client: runtime.client });
  const reorder = reorderTaskMutation({ client: runtime.client });
  const mutation = useMutation<MoveTaskResponse, unknown, TaskPlacement>({
    mutationKey,
    networkMode: 'always',
    retry: false,
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

    setNotice('Saving task move…');
    try {
      await mutation.mutateAsync(command);
      setNotice('Task moved.');
      report('Task moved.', 'success');

      return { success: true as const };
    } catch (failure) {
      const error = apiError(failure);
      setNotice(error.message);
      report(error.message, 'error');

      return { success: false as const, error };
    }
  };

  return { pending, submit, notice };
}
