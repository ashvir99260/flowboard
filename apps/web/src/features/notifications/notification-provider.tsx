'use client';

import { ToastHost } from '@flowboard/ui';
import { createContext, useContext, useState, useSyncExternalStore } from 'react';

import { createNotificationStore } from './notification-store';

import type { ReactNode } from 'react';

const Context = createContext<ReturnType<typeof createNotificationStore> | null>(null);
const empty: ReturnType<ReturnType<typeof createNotificationStore>['snapshot']> = [];

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createNotificationStore);
  const queue = useSyncExternalStore(store.subscribe, store.snapshot, () => empty);

  return (
    <Context.Provider value={store}>
      <ToastHost message={queue[0]} onDismiss={store.dismiss}>
        {children}
      </ToastHost>
    </Context.Provider>
  );
}

export function useNotifications() {
  const store = useContext(Context);

  if (!store) throw new Error('Notifications require NotificationProvider');

  return store;
}
