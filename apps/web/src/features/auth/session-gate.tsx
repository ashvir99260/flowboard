'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from '../../providers/app-providers';

import type { ReactNode } from 'react';

export function SessionLoading() {
  return (
    <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 3, p: 6 }}>
      <CircularProgress aria-hidden="true" size={20} />
      <Typography>Opening Flowboard…</Typography>
    </Box>
  );
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
