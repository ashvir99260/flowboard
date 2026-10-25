'use client';

import { bulkUpdateTasksMutation } from '@flowboard/api-client/tanstack-query';
import { BulkUpdateTasksSchema } from '@flowboard/contracts';
import { useQueryClient } from '@tanstack/react-query';

import { apiError } from '../../lib/apiError';
import { useApiMutation } from '../../lib/useApiMutation';
import { useNotifications } from '../notifications/useNotifications';
import { isTaskBusy } from '../tasks/taskEvents';

import { readBulkTaskResponse } from './bulkTaskData';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { BulkUpdateTasks, ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';

class BulkResponseError extends Error {}

export function useBulkUpdateTasksMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  configuration: { fields: readonly ResolvedField[]; statuses: readonly ResolvedStatus[] },
) {
  const notifications = useNotifications();
  const client = useQueryClient();

  const generated = bulkUpdateTasksMutation({ client: runtime.client });

  const mutation = useApiMutation({
    mutationKey: ['task-write', scope.revision, scope.userId, scope.workspaceId],
    mutationFn: async (
      command: { body: BulkUpdateTasks; listId: string; tasks: readonly Task[] },
      context,
    ) => {
      const body = BulkUpdateTasksSchema.parse(command.body);
      const response = await generated.mutationFn!({ body }, context);
      const parsed = readBulkTaskResponse(response, {
        ...configuration,
        command: body,
        tasks: command.tasks,
        workspaceId: scope.workspaceId,
        listId: command.listId,
      });
      if (!parsed.success)
        throw new BulkResponseError(
          'The bulk result could not be validated. Reload the list before selecting tasks again.',
        );

      return parsed.response;
    },
  });

  const submit = async (command: {
    body: BulkUpdateTasks;
    listId: string;
    tasks: readonly Task[];
  }) => {
    const report = notifications.capture();
    if (command.tasks.some(({ id }) => isTaskBusy(client, scope, id))) {
      const error: ReturnType<typeof apiError> = {
        code: 'BUSY',
        message: 'One of the selected tasks is already saving.',
      };
      report(error.message, 'error');

      return { success: false as const, error };
    }

    try {
      const response = await mutation.mutateAsync(command);
      report(
        response.changedTaskIds.length
          ? `${response.changedTaskIds.length} tasks updated.`
          : 'Selected tasks already have these values.',
        'success',
      );

      return { success: true as const, response };
    } catch (error) {
      const failure: ReturnType<typeof apiError> =
        error instanceof BulkResponseError
          ? { code: 'INVALID_RESPONSE', message: error.message }
          : apiError(error);
      report(failure.message, 'error');

      return { success: false as const, error: failure };
    }
  };

  return { submit };
}
