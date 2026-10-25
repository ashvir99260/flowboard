'use client';

import { NotificationProvider } from '../features/notifications/NotificationProvider';

import { RuntimeProviders } from './RuntimeProviders';

import type { ReactNode } from 'react';

export function AppProviders(props: Readonly<{ children: ReactNode; realtimeUrl: string | null }>) {
  return (
    <NotificationProvider>
      <RuntimeProviders {...props} />
    </NotificationProvider>
  );
}
