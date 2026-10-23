import { DatabaseError } from '@flowboard/database';
import { Catch, HttpException } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

import { ApiException } from '../errors/api-exception.js';

import type { ErrorCode, ValidationIssue } from '@flowboard/contracts';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';

const failures: Record<number, { code: ErrorCode; message: string }> = {
  400: { code: 'VALIDATION_FAILED', message: 'Request validation failed' },
  401: { code: 'UNAUTHENTICATED', message: 'Authentication required' },
  403: { code: 'FORBIDDEN', message: 'Access denied' },
  404: { code: 'NOT_FOUND', message: 'Resource not found' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'Request is too large' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests' },
  500: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' },
  503: { code: 'SERVICE_UNAVAILABLE', message: 'Required dependencies unavailable' },
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    let status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (exception && typeof exception === 'object' && 'type' in exception) {
      if (exception.type === 'entity.too.large') status = 413;
      else if (exception.type === 'entity.parse.failed') status = 400;
    }
    if (exception instanceof DatabaseError) {
      status =
        exception.code === 'EMAIL_IN_USE'
          ? 409
          : exception.code === 'UNAUTHENTICATED'
            ? 401
            : exception.code === 'SERVICE_UNAVAILABLE'
              ? 503
              : exception.code === 'INTERNAL_ERROR'
                ? 500
                : exception.code === 'NOT_FOUND'
                  ? 404
                  : exception.code === 'MEMBERSHIP_REQUIRED'
                    ? 403
                    : 400;
    }
    let error = failures[status] ?? failures[500]!;
    let details: ValidationIssue[] | undefined;
    if (exception instanceof ApiException && status < 500) {
      error = { code: exception.code, message: exception.message };
      details = exception.details;
    } else if (exception instanceof DatabaseError && status < 500) {
      error = { code: exception.code, message: exception.message };
    } else if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError();
      if (zodError instanceof ZodError)
        details = zodError.issues.map((issue) => ({
          code: issue.code,
          message: [...issue.message].slice(0, 500).join(''),
          path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
        }));
    }
    const response = host.switchToHttp().getResponse<{
      setHeader(name: string, value: string): void;
      status(code: number): { json(body: unknown): void };
    }>();
    if (status === 429 && exception instanceof ApiException && exception.retryAfterSeconds)
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    response.status(status).json({ error: { ...error, ...(details ? { details } : {}) } });
  }
}
