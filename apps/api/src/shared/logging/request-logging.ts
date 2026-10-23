import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { bindLogContext, withLogContext } from '@flowboard/logger';

import type { Logger } from '@flowboard/logger';
import type { IncomingMessage, ServerResponse } from 'node:http';

export function requestLogging(logger: Logger) {
  return (
    request: IncomingMessage & { route?: { path?: unknown } },
    response: ServerResponse,
    next: () => void,
  ) => {
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);
    withLogContext({ requestId }, () => {
      const start = performance.now();
      let completed = false;
      const finish = bindLogContext(() => {
        if (completed) return;

        completed = true;
        const route = typeof request.route?.path === 'string' ? request.route.path : 'unmatched';
        const aborted = !response.writableFinished;
        const level =
          aborted || response.statusCode >= 500
            ? 'error'
            : response.statusCode >= 400
              ? 'warn'
              : route.startsWith('/health/')
                ? 'debug'
                : 'info';
        logger[level]('http.completed', {
          method: request.method,
          route,
          statusCode: response.statusCode,
          durationMs: performance.now() - start,
          outcome: aborted ? 'aborted' : 'completed',
        });
      });
      response.once('finish', finish);
      response.once('close', finish);
      logger.debug('http.started', { method: request.method });
      next();
    });
  };
}
