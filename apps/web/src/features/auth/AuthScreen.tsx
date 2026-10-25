'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from '../../providers/useSession';

import { LoginForm } from './LoginForm';
import { SessionLoading } from './SessionLoading';
import { SignupForm } from './SignupForm';

export function AuthScreen({ mode }: Readonly<{ mode: 'login' | 'signup' }>) {
  const { runtime, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/workspaces');
  }, [router, status]);

  if (!runtime || status === 'booting' || status === 'authenticated') return <SessionLoading />;

  return mode === 'login' ? <LoginForm /> : <SignupForm />;
}
