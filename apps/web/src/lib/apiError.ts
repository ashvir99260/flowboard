import { ClientSessionError } from '@flowboard/api-client/session';
import { ErrorEnvelopeSchema } from '@flowboard/contracts';

import type { ErrorResponseDtoOutput } from '@flowboard/api-client/types';
import type { ValidationIssue } from '@flowboard/contracts';

export type ApiRequestError = ErrorResponseDtoOutput | Error;

export class ApiMutationError extends Error {
  readonly code: string;
  readonly details?: ValidationIssue[];

  constructor(error: ReturnType<typeof apiError>) {
    super(error.message);
    this.name = 'ApiMutationError';
    this.code = error.code;
    this.details = error.details;
  }
}

export function apiError(error: unknown): {
  code: string;
  details?: ValidationIssue[];
  message: string;
} {
  if (error instanceof ApiMutationError)
    return {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };

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
