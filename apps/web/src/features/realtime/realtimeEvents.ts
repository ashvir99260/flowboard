import { RealtimeInvalidationSchema } from '@flowboard/contracts';

import type { RealtimeInvalidation } from '@flowboard/contracts';

/** Invalidations refetch current state, so a late event cannot restore an older task. */
export function createInvalidationTracker() {
  const seen = new Set<string>();

  return (input: unknown): RealtimeInvalidation | null => {
    const parsed = RealtimeInvalidationSchema.safeParse(input);
    if (!parsed.success) return null;

    const event = parsed.data;
    if (event.kind === 'resync') return event;

    const key = `${event.eventId}:${event.kind === 'list' ? event.listId : 'workspace'}`;
    if (seen.has(key)) return null;

    seen.add(key);
    if (seen.size > 2048) seen.delete(seen.values().next().value!);

    return event;
  };
}

export function createRealtimeBus() {
  const listeners = new Set<{ handler: (event: RealtimeInvalidation) => void; listId?: string }>();

  const changes = new Set<() => void>();
  const changed = () => {
    for (const handler of changes) handler();
  };

  return {
    onSubscriptionsChanged(handler: () => void) {
      changes.add(handler);

      return () => {
        changes.delete(handler);
      };
    },
    lists() {
      return [...new Set([...listeners].flatMap((entry) => entry.listId ?? []))];
    },
    listen(listId: string | undefined, handler: (event: RealtimeInvalidation) => void) {
      const entry = { listId, handler };
      listeners.add(entry);
      changed();

      return () => {
        listeners.delete(entry);
        changed();
      };
    },
    dispatch(event: RealtimeInvalidation) {
      for (const listener of listeners)
        if (event.kind !== 'list' || listener.listId === event.listId) listener.handler(event);
    },
  };
}
