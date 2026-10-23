import { getLivenessOptions, getReadinessOptions } from '../src/index.js';

import type { GetLivenessResponse, GetReadinessResponse } from '../src/index.js';

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
  input: import('../src/index.js').LogInData['body'],
  response: import('../src/index.js').LogInResponse,
) {
  const password: string = input.password;
  const role: 'admin' | 'member' | undefined = response.data.activeWorkspace?.role;
  return { password, role };
}
