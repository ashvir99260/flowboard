'use client';

import { useRealtime } from '../realtime/useRealtime';

type WorkspaceListSubscriptionProps = {
  listId: string;
  refresh: () => void;
};

export function WorkspaceListSubscription({ listId, refresh }: WorkspaceListSubscriptionProps) {
  useRealtime(listId, (event) => {
    if (event.kind === 'list' || event.kind === 'resync') refresh();
  });

  return null;
}
