import { AppProviders } from '../../src/providers/app-providers';

import type { ReactNode } from 'react';

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <AppProviders>{children}</AppProviders>;
}
