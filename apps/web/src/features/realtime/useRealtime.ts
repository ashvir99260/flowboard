'use client';

import { useContext, useEffect, useRef } from 'react';

import { RealtimeContext } from './realtimeContext';

import type { RealtimeDeliveryContext } from './realtimeEvents';
import type { RealtimeInvalidation } from '@flowboard/contracts';

export function useRealtime(
  listId: string | undefined,
  handler: (event: RealtimeInvalidation, context?: RealtimeDeliveryContext) => void,
) {
  const bus = useContext(RealtimeContext);
  const latest = useRef(handler);

  useEffect(() => {
    latest.current = handler;
  }, [handler]);

  useEffect(
    () => bus?.listen(listId, (event, context) => latest.current(event, context)),
    [bus, listId],
  );
}
