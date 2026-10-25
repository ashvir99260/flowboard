'use client';

import { useRealtime } from '../realtime/useRealtime';

export function WorkspaceListSubscription({
  listId,
  refresh,
}: {
  listId: string;
  refresh: () => void;
}) {
  useRealtime(listId, (event) => {
    if (event.kind === 'list' || event.kind === 'resync') refresh();
  });

  return null;
}
