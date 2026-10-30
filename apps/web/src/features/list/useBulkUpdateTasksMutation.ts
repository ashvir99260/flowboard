'use client';

import { BulkUpdateTasksSchema } from '@flowboard/contracts';
import { useQueryClient } from '@tanstack/react-query';

import { bulkUpdateTasksMutation } from '../../generated/apiHooks.gen';
import { apiError, ApiMutationError } from '../../lib/apiError';
import { useApiMutation } from '../../lib/useApiMutation';
import { useNotifications } from '../notifications/useNotifications';
import { isTaskBusy } from '../tasks/taskEvents';

import { readBulkTaskResponse } from './bulkTaskData';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { BulkUpdateTasks, ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';
import type {
  MutationFunctionContext,
  UseMutationOptions,
  UseMutationResult,
} from '@tanstack/react-query';

class BulkResponseError extends Error {}

export type BulkUpdateTasksMutationVariables = {
  body: BulkUpdateTasks;
  listId: string;
  tasks: readonly Task[];
};

export type BulkUpdateTasksMutationData = Extract<
  ReturnType<typeof readBulkTaskResponse>,
  { success: true }
>['response'];

type BulkUpdateTasksMutationContext = {
  report: ReturnType<ReturnType<typeof useNotifications>['capture']>;
};
export type BulkUpdateTasksMutationOptions = Omit<
  UseMutationOptions<
    BulkUpdateTasksMutationData,
    ApiMutationError,
    BulkUpdateTasksMutationVariables,
    BulkUpdateTasksMutationContext
  >,
  'mutationKey' | 'mutationFn' | 'retry' | 'networkMode' | 'onMutate'
>;

export type BulkUpdateTasksMutationResult = UseMutationResult<
  BulkUpdateTasksMutationData,
  ApiMutationError,
  BulkUpdateTasksMutationVariables,
  BulkUpdateTasksMutationContext
>;

export async function requestBulkUpdateTasks(
  requestClient: ClientRuntime['client'],
  scope: QueryScope,
  configuration: { fields: readonly ResolvedField[]; statuses: readonly ResolvedStatus[] },
  command: BulkUpdateTasksMutationVariables,

  mutationContext: MutationFunctionContext,
): Promise<BulkUpdateTasksMutationData> {
  try {
    const body = BulkUpdateTasksSchema.parse(command.body);
    const response = await bulkUpdateTasksMutation({ client: requestClient }).mutationFn(
      { body },
      mutationContext,
    );
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
  } catch (cause) {
    throw new ApiMutationError(
      cause instanceof BulkResponseError
        ? { code: 'INVALID_RESPONSE', message: cause.message }
        : apiError(cause),
    );
  }
}

export function useBulkUpdateTasksMutation(
  runtime: ClientRuntime,
  scope: QueryScope,
  configuration: { fields: readonly ResolvedField[]; statuses: readonly ResolvedStatus[] },
  options: BulkUpdateTasksMutationOptions = {},
): BulkUpdateTasksMutationResult {
  const notifications = useNotifications();

  const capture = notifications.captureFactory();

  const client = useQueryClient();

  const mutationKey = ['task-write', scope.revision, scope.userId, scope.workspaceId];

  const mutation = useApiMutation<
    BulkUpdateTasksMutationData,
    ApiMutationError,
    BulkUpdateTasksMutationVariables,
    BulkUpdateTasksMutationContext
  >({
    ...options,
    mutationKey,
    mutationFn: (command, mutationContext) =>
      requestBulkUpdateTasks(runtime.client, scope, configuration, command, mutationContext),
    onMutate: (command) => {
      const report = capture();
      if (command.tasks.some(({ id }) => isTaskBusy(client, scope, id, true))) {
        report('One of the selected tasks is already saving.', 'error');
        throw new ApiMutationError({
          code: 'BUSY',
          message: 'One of the selected tasks is already saving.',
        });
      }

      return { report };
    },
    onSuccess: async (response, command, context, mutationContext) => {
      context?.report(
        response.changedTaskIds.length
          ? `${response.changedTaskIds.length} tasks updated.`
          : 'Selected tasks already have these values.',
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
