import { DatabaseError } from '@flowboard/database';
import { Catch } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.js';

import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Socket } from 'socket.io';

@Catch()
export class RealtimeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const code =
      exception instanceof ApiException || exception instanceof DatabaseError
        ? exception.code
        : 'INTERNAL_ERROR';
    // Never echo packet bodies, raw errors or adapter internals.
    host
      .switchToWs()
      .getClient<Socket>()
      .emit('exception', {
        error: { code, message: 'Realtime request could not be authorized or processed' },
      });
  }
}
