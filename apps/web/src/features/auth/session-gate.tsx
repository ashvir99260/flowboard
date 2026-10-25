'use client';

import { LoadingState } from '@flowboard/ui';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from '../../providers/app-providers';

import type { ReactNode } from 'react';

export function SessionLoading() {
  return <LoadingState>Opening Flowboard…</LoadingState>;
}

export function SessionGate({ children }: Readonly<{ children: ReactNode }>) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/login');
  }, [router, status]);

  return status === 'authenticated' ? children : <SessionLoading />;
}

export function HomeRedirect() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/workspaces');

    if (status === 'anonymous') router.replace('/login');
  }, [router, status]);

  return <SessionLoading />;
}
