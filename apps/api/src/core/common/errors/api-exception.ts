import { HttpException } from '@nestjs/common';

import type { ErrorCode, ValidationIssue } from '@flowboard/contracts';

export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ValidationIssue[],
    readonly retryAfterSeconds?: number,
  ) {
    super(message, status);
  }
}
