'use client';

import { useContext } from 'react';
import { SessionContext } from './sessionContext';

export function useSession() {
  const value = useContext(SessionContext);

  if (!value) throw new Error('Session components require AppProviders');

  return value;
}
