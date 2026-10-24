import { setupClient } from '@flowboard/api-client/session';
import { getLivenessOptions, getReadinessOptions } from '@flowboard/api-client/tanstack-query';

import type { SetupClientOptions } from '@flowboard/api-client/session';
import type { GetLivenessResponse, GetReadinessResponse } from '@flowboard/api-client/types';

export function consumeHealth(live: GetLivenessResponse, ready: GetReadinessResponse) {
  const liveStatus: 'ok' = live.status;
  const readyStatus: 'ready' = ready.status;

  return {
    live: getLivenessOptions(),
    liveStatus,
    ready: getReadinessOptions(),
    readyStatus,
  };
}

export function consumeAuth(
  input: import('@flowboard/api-client/types').LogInData['body'],
  response: import('@flowboard/api-client/types').LogInResponse,
) {
  const password: string = input.password;
  const role: 'admin' | 'member' | undefined = response.data.activeWorkspace?.role;

  return { password, role };
}

export function consumeRefresh(
  input: import('@flowboard/api-client/types').RefreshSessionData['body'],
) {
  return input;
}

export { listTasks } from '@flowboard/api-client/sdk';

export {
  createTaskMutation,
  listTasksInfiniteOptions,
  listTasksOptions,
  listTasksQueryKey,
} from '@flowboard/api-client/tanstack-query';

export type {
  CreateTaskData,
  CreateTaskResponse,
  ListTasksData,
} from '@flowboard/api-client/types';

export function consumeSession(options: SetupClientOptions) {
  const session = setupClient(options);
  const query = getLivenessOptions({ client: session.client });

  return { query, session };
}
