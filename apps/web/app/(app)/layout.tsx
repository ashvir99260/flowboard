import { connection } from 'next/server';

import { AppProviders } from '../../src/providers/AppProviders';
import { readRealtimeUrl } from '../../src/server/realtimeConfig';

import type { ReactNode } from 'react';

type AppLayoutProps = Readonly<{ children: ReactNode }>;

export default async function AppLayout({ children }: AppLayoutProps) {
  await connection();

  return (
    <AppProviders realtimeUrl={readRealtimeUrl(process.env.REALTIME_PUBLIC_URL)}>
      {children}
    </AppProviders>
  );
}
