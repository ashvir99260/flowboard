import { ClientSessionError } from '@flowboard/api-client/session';
import { ErrorEnvelopeSchema } from '@flowboard/contracts';

import type { ValidationIssue } from '@flowboard/contracts';

export function apiError(error: unknown): {
  code: string;
  details?: ValidationIssue[];
  message: string;
} {
  const parsed = ErrorEnvelopeSchema.safeParse(error);
  if (parsed.success) return parsed.data.error;

  if (error instanceof ClientSessionError)
    return {
      code: error.code,
      message:
        error.code === 'COORDINATION_UNAVAILABLE'
          ? 'Session storage is unavailable. Enable site storage and use a browser with Web Locks support.'
          : 'Your session ended. Sign in again.',
    };

  return { code: 'NETWORK_ERROR', message: 'Unable to reach Flowboard. Please try again.' };
}
