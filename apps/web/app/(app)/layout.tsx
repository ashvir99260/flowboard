import { connection } from 'next/server';

import { AppProviders } from '../../src/providers/app-providers';
import { readRealtimeUrl } from '../../src/server/realtime-config';

import type { ReactNode } from 'react';

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();

  return (
    <AppProviders realtimeUrl={readRealtimeUrl(process.env.REALTIME_PUBLIC_URL)}>
      {children}
    </AppProviders>
  );
}
