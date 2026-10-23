import { createServer } from 'node:net';

import { createLogger, readLogLevel } from '@flowboard/logger';

let logger = createLogger({ level: 'info', service: 'worker' });
let stage = 'log_config';

function bootstrap() {
  logger = createLogger({ service: 'worker', level: readLogLevel(process.env.LOG_LEVEL) });
  stage = 'listen';
  const port = Number(process.env.PORT ?? 3002);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    logger.fatal('worker.startup.failed', { code: 'INVALID_PORT' });
    process.exitCode = 1;

    return;
  }

  // TODO(P11-02): Replace process-only liveness with the real BullMQ worker lifecycle.
  const server = createServer((socket) => socket.end(() => socket.destroy()));
  server.on('error', () => {
    logger.fatal('worker.startup.failed', { code: 'LISTEN_FAILED' });
    process.exitCode = 1;
  });
  server.once('close', () => logger.info('worker.stopped'));
  server.listen(port, process.env.HOST ?? '127.0.0.1', () => {
    const address = server.address();
    if (address && typeof address !== 'string') {
      logger.info('worker.started', { port: address.port, outcome: 'process_only' });
    }
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => server.close());
  }
}

try {
  bootstrap();
} catch {
  logger.fatal('worker.startup.failed', {
    code: stage === 'log_config' ? 'INVALID_LOG_LEVEL' : 'LISTEN_FAILED',
    operation: stage,
  });
  process.exitCode = 1;
}
