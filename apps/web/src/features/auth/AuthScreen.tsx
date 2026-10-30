'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useSession } from '../../providers/useSession';

import { LoginForm } from './LoginForm';
import { SessionLoading } from './SessionLoading';
import { SignupForm } from './SignupForm';

type AuthScreenProps = Readonly<{ mode: 'login' | 'signup' }>;

export function AuthScreen({ mode }: AuthScreenProps) {
  const { runtime, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'authenticated') router.replace('/workspaces');
  }, [router, status]);

  if (!runtime || status === 'booting' || status === 'authenticated') return <SessionLoading />;

  return mode === 'login' ? <LoginForm /> : <SignupForm />;
}
