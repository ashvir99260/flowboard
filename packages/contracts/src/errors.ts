import { z } from 'zod';

import { textSchema } from './identifiers.js';

export const ErrorExamples = {
  400: {
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed',
      details: [{ code: 'unrecognized_keys', message: 'Unexpected request fields', path: [] }],
    },
  },
  401: { error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' } },
  403: { error: { code: 'ORIGIN_REJECTED', message: 'Request origin is not allowed' } },
  404: { error: { code: 'NOT_FOUND', message: 'Resource not found' } },
  409: { error: { code: 'EMAIL_IN_USE', message: 'Email is already registered' } },
  413: { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large' } },
  429: { error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts' } },
  500: { error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
  503: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Required dependencies unavailable' } },
  refreshExpired: { error: { code: 'SESSION_EXPIRED', message: 'Session expired' } },
  refreshReused: { error: { code: 'REFRESH_REUSED', message: 'Refresh credential already used' } },
};

export const ErrorCodeSchema = z
  .enum([
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
    'WORKSPACE_ARCHIVED',
    'MEMBERSHIP_EXISTS',
    'ORIGIN_REJECTED',
    'NOT_FOUND',
    'VERSION_CONFLICT',
    'CONFIG_CONFLICT',
    'CURSOR_STALE',
    'STATUS_IN_USE',
    'FIELD_IN_USE',
    'TASK_RELATION_IN_USE',
    'CONFIG_INVALIDATES_TASKS',
    'LAST_ADMIN',
    'EMAIL_IN_USE',
    'INVITATION_UNAVAILABLE',
    'PAYLOAD_TOO_LARGE',
    'RATE_LIMITED',
    'INTERNAL_ERROR',
    'SERVICE_UNAVAILABLE',
  ])
  .meta({
    description:
      'Stable machine-readable error identifier. Clients should branch on this value rather than message text.',
    example: 'VALIDATION_FAILED',
    title: 'Error code',
  });

export const ValidationIssueSchema = z
  .strictObject({
    code: textSchema(64, 1).meta({
      description: 'Validator identifier for the rejected value or unknown field.',
      example: 'invalid_format',
      title: 'Validation issue code',
    }),
    message: textSchema(500, 1).meta({
      description: 'Human-readable explanation of this validation issue.',
      example: 'Invalid email address',
      title: 'Validation message',
    }),
    path: z.array(z.union([z.string(), z.number().int().nonnegative()])).meta({
      title: 'Field path',
      description:
        'Path to the rejected field, using property names and zero-based array indexes. Empty means the request root.',
      example: ['email'],
    }),
  })
  .meta({
    title: 'Validation issue',
    description: 'One field-level validation failure.',
    example: { code: 'invalid_format', message: 'Invalid email address', path: ['email'] },
  });

export const ErrorEnvelopeSchema = z
  .strictObject({
    error: z
      .strictObject({
        code: ErrorCodeSchema,
        details: z.array(ValidationIssueSchema).optional().meta({
          title: 'Validation details',
          description:
            'Optional field-level issues. Non-validation failures usually omit this array.',
          example: ErrorExamples[400].error.details,
        }),
        message: textSchema(500, 1).meta({
          description:
            'Sanitized human-readable explanation. Internal errors never include stack traces or secrets.',
          example: 'Request validation failed',
          title: 'Error message',
        }),
      })
      .meta({
        title: 'Error details',
        description: 'Stable error code, safe message and optional validation paths.',
        example: ErrorExamples[400].error,
      }),
  })
  .meta({
    title: 'Error response',
    description: 'Consistent error envelope for unsuccessful API responses.',
    example: ErrorExamples[400],
  });

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
