'use client';

import type { RealtimeInvalidation } from '@flowboard/contracts';
import { useContext, useEffect, useRef } from 'react';
import { RealtimeContext } from './realtimeContext';

export function useRealtime(
  listId: string | undefined,
  handler: (event: RealtimeInvalidation) => void,
) {
  const bus = useContext(RealtimeContext);
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(() => bus?.listen(listId, (event) => latest.current(event)), [bus, listId]);
}
