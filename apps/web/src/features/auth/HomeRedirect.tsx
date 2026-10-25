'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '../../providers/useSession';
import { SessionLoading } from './SessionLoading';

export function HomeRedirect() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/workspaces');

    if (status === 'anonymous') router.replace('/login');
  }, [router, status]);

  return <SessionLoading />;
}
