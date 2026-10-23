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
