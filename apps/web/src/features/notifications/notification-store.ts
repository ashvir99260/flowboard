import type { ToastMessage, ToastSeverity } from '@flowboard/ui';

/** UI-only state: never stores request payloads, credentials or task content. */
export function createNotificationStore() {
  let queue: readonly ToastMessage[] = [];
  let generation = 0;
  let sequence = 0;
  const listeners = new Set<() => void>();
  const events = new Set<string>();
  const publish = (next: readonly ToastMessage[]) => {
    queue = next;
    for (const listener of listeners) listener();
  };
  const show = (message: string, severity: ToastSeverity) => {
    const next = { id: ++sequence, message, severity };
    // Retain the current toast and the newest pending messages during a burst.
    publish(queue.length < 5 ? [...queue, next] : [queue[0]!, ...queue.slice(-3), next]);
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => queue,
    dismiss(id: number) {
      publish(queue.filter((entry) => entry.id !== id));
    },
    clear() {
      generation++;
      events.clear();
      publish([]);
    },
    capture() {
      const expected = generation;
      let reported = false;

      return (message: string, severity: ToastSeverity) => {
        if (expected !== generation || reported) return;

        reported = true;
        show(message, severity);
      };
    },
    show,
    remote(eventId: string, message: string) {
      if (events.has(eventId)) return;

      events.add(eventId);
      if (events.size > 2048) events.delete(events.values().next().value!);

      show(message, 'info');
    },
  };
}
