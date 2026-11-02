'use client';

import { useEffect, useState } from 'react';

import { createRefreshQueue } from './createRefreshQueue';

export function useBackgroundRefresh(refresh: () => void, reading: boolean, failed: boolean) {
  const [queue] = useState(() => createRefreshQueue(refresh));

  useEffect(() => {
    queue.setRefresh(refresh);
  }, [queue, refresh]);

  useEffect(() => {
    if (failed) queue.clear();

    queue.settle(reading && !failed);
  }, [failed, queue, reading]);

  return queue;
}
