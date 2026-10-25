'use client';

import { setupClient } from '@flowboard/api-client/session';
import type { SessionEnvelope } from '@flowboard/contracts';
import { createContext } from 'react';
import type { QueryScope } from '../lib/queryScope';

export type ClientRuntime = ReturnType<typeof setupClient>;

export type SessionState = {
  revision: number;
  session: SessionEnvelope | null;
  status: 'booting' | 'changing' | 'authenticated' | 'anonymous';
};

interface SessionContextValue extends SessionState {
  login: ClientRuntime['login'];
  logout: () => Promise<void>;
  runtime: ClientRuntime | null;
  scope: QueryScope | null;
  signup: ClientRuntime['signup'];
  switchWorkspace: ClientRuntime['switchWorkspace'];
}

export const SessionContext = createContext<SessionContextValue | null>(null);
