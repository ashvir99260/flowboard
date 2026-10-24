import { SessionEnvelopeSchema } from '@flowboard/contracts';

import type { SessionSync } from './session-sync.js';
import type { SessionEnvelope } from '@flowboard/contracts';

export type SessionChangeReason =
  'login' | 'refresh' | 'switch' | 'logout' | 'expired' | 'external' | 'disposed';

export class ClientSessionError extends Error {
  constructor(
    public readonly code: 'SESSION_CHANGED' | 'UNAUTHENTICATED' | 'COORDINATION_UNAVAILABLE',
  ) {
    super(
      code === 'SESSION_CHANGED'
        ? 'The session changed; discard this request.'
        : 'Sign in to continue.',
    );
    this.name = 'ClientSessionError';
  }
}

export function createSessionState(
  sync: SessionSync,
  initial: SessionEnvelope | undefined,
  changed: (session: SessionEnvelope | null, reason: SessionChangeReason) => void,
) {
  let session = initial ? SessionEnvelopeSchema.parse(initial) : null;
  let epoch = 0;
  let tokenRevision = 0;
  let status: 'active' | 'unknown' | 'changing' | 'closed' = initial ? 'active' : 'unknown';
  let revision = sync.version();
  let disposed = false;
  const snapshot = () => (status === 'active' && session ? structuredClone(session) : null);
  const notify = (reason: SessionChangeReason) =>
    changed(status === 'active' ? snapshot() : null, reason);
  function invalidate(reason: SessionChangeReason, publish = true, changing = false) {
    if (disposed) {
      if (reason === 'disposed') return epoch;

      throw new ClientSessionError('UNAUTHENTICATED');
    }

    if (reason === 'disposed') disposed = true;

    epoch++;
    status = changing ? 'changing' : 'closed';
    if (!changing) session = null;

    if (publish) revision = sync.bump();
    else revision = sync.version();

    notify(reason);

    return epoch;
  }
  function assertAuthority(expected = epoch) {
    if (disposed) throw new ClientSessionError('UNAUTHENTICATED');

    if (sync.version() !== revision) invalidate('external', false);

    if (expected !== epoch) throw new ClientSessionError('SESSION_CHANGED');
  }
  function assert(expected = epoch, changing = false) {
    assertAuthority(expected);
    if (status === 'closed' || (status === 'changing' && !changing))
      throw new ClientSessionError('UNAUTHENTICATED');
  }
  function accept(value: unknown, reason: 'login' | 'refresh' | 'switch', expected?: number) {
    if (disposed) throw new ClientSessionError('UNAUTHENTICATED');

    if (expected !== undefined) assert(expected, reason !== 'refresh');

    const parsed = SessionEnvelopeSchema.parse(value);
    if (
      reason === 'refresh' &&
      session &&
      (parsed.data.user.id !== session.data.user.id ||
        parsed.data.activeWorkspace?.id !== session.data.activeWorkspace?.id)
    )
      throw new ClientSessionError('SESSION_CHANGED');

    if (reason === 'login' && expected === undefined) {
      epoch++;
      revision = sync.bump();
    }

    session = parsed;
    status = 'active';
    tokenRevision++;
    notify(reason);

    return snapshot()!;
  }

  return {
    accept,
    assert,
    assertAuthority,
    inspect: () => ({ epoch, session, tokenRevision }),
    invalidate,
    snapshot,
  };
}
