'use client';

import { ToastHost } from '@flowboard/ui';
import { useState, useSyncExternalStore } from 'react';

import { NotificationContext } from './notificationContext';
import { createNotificationStore } from './notificationStore';

import type { ReactNode } from 'react';

const empty: ReturnType<ReturnType<typeof createNotificationStore>['snapshot']> = [];

type NotificationProviderProps = { children: ReactNode };

export function NotificationProvider({ children }: NotificationProviderProps) {
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
