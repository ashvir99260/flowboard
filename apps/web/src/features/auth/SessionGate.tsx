'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from '../../providers/useSession';

import { SessionLoading } from './SessionLoading';

import type { ReactNode } from 'react';

type SessionGateProps = Readonly<{ children: ReactNode }>;

export function SessionGate({ children }: SessionGateProps) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [router, status]);

  return status === 'authenticated' ? children : <SessionLoading />;
}
