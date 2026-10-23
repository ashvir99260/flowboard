import { z } from 'zod';

import { textSchema } from './identifiers.js';

export const ErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'STATUS_NOT_AVAILABLE',
  'FIELD_VALUE_INVALID',
  'INVALID_PARENT',
  'INVALID_ANCHOR',
  'INVALID_CURSOR',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'REFRESH_REUSED',
  'FORBIDDEN',
  'MEMBERSHIP_REQUIRED',
  'ORIGIN_REJECTED',
  'NOT_FOUND',
  'VERSION_CONFLICT',
  'CONFIG_CONFLICT',
  'CURSOR_STALE',
  'STATUS_IN_USE',
  'FIELD_IN_USE',
  'CONFIG_INVALIDATES_TASKS',
  'LAST_ADMIN',
  'EMAIL_IN_USE',
  'INVITATION_UNAVAILABLE',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'SERVICE_UNAVAILABLE',
]);
export const ValidationIssueSchema = z.strictObject({
  code: textSchema(64, 1),
  message: textSchema(500, 1),
  path: z.array(z.union([z.string(), z.number().int().nonnegative()])),
});
export const ErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({
    code: ErrorCodeSchema,
    details: z.array(ValidationIssueSchema).optional(),
    message: textSchema(500, 1),
  }),
});
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
