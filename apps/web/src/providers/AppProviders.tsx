'use client';

import type { ReactNode } from 'react';
import { NotificationProvider } from '../features/notifications/NotificationProvider';
import { RuntimeProviders } from './RuntimeProviders';

export function AppProviders(props: Readonly<{ children: ReactNode; realtimeUrl: string | null }>) {
  return (
    <NotificationProvider>
      <RuntimeProviders {...props} />
    </NotificationProvider>
  );
}
