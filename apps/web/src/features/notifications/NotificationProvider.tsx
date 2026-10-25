'use client';

import { ToastHost } from '@flowboard/ui';
import type { ReactNode } from 'react';
import { useState, useSyncExternalStore } from 'react';
import { NotificationContext } from './notificationContext';
import { createNotificationStore } from './notificationStore';

const empty: ReturnType<ReturnType<typeof createNotificationStore>['snapshot']> = [];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createNotificationStore);
  const queue = useSyncExternalStore(store.subscribe, store.snapshot, () => empty);

  return (
    <NotificationContext.Provider value={store}>
      <ToastHost message={queue[0]} onDismiss={store.dismiss}>
        {children}
      </ToastHost>
    </NotificationContext.Provider>
  );
}
