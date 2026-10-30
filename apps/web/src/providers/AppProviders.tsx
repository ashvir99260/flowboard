'use client';

import { NotificationProvider } from '../features/notifications/NotificationProvider';

import { RuntimeProviders } from './RuntimeProviders';

import type { ReactNode } from 'react';

type AppProvidersProps = Readonly<{ children: ReactNode; realtimeUrl: string | null }>;

export function AppProviders(props: AppProvidersProps) {
  return (
    <NotificationProvider>
      <RuntimeProviders {...props} />
    </NotificationProvider>
  );
}
