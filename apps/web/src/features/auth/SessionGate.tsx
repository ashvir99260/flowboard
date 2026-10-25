'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useSession } from '../../providers/useSession';
import { SessionLoading } from './SessionLoading';

export function SessionGate({ children }: Readonly<{ children: ReactNode }>) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [router, status]);

  return status === 'authenticated' ? children : <SessionLoading />;
}
