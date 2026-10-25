import { once } from 'node:events';

import { createOutboxRuntime } from '@flowboard/jobs';
import { createLogger, readLogLevel } from '@flowboard/logger';

import { createActivityWorker } from './activity.worker.js';
import { readWorkerConfig, WorkerConfigError } from './config.js';
import { createHealthServer } from './health.js';
import { startWorkerRuntime } from './runtime.js';

let logger = createLogger({ level: 'info', service: 'worker' });
let stage = 'log_config';

async function bootstrap() {
  logger = createLogger({ service: 'worker', level: readLogLevel(process.env.LOG_LEVEL) });
  stage = 'configuration';
  const config = readWorkerConfig(process.env);
  const activity = createActivityWorker(config.databaseUrl, config.redisUrl, logger);
  let outbox;
  try {
    outbox = createOutboxRuntime(config.databaseUrl, config.redisUrl, logger);
  } catch (error) {
    await activity.close();
    throw error;
  }
  stage = 'dependencies';
  const runtime = await startWorkerRuntime(activity, outbox);
  const server = createHealthServer(runtime);
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      server.close();
      server.closeAllConnections();
      await runtime.close();
      logger.info('worker.stopped');
    })());
  try {
    stage = 'listen';
    server.listen(config.port, config.host);
    await once(server, 'listening');
    const address = server.address();
    if (address && typeof address !== 'string')
      logger.info('worker.started', { port: address.port, outcome: 'activity_worker' });

    logger.info('worker.ready');
    for (const signal of ['SIGINT', 'SIGTERM'] as const)
      process.once(signal, () => {
        void close().catch(() => {
          process.exitCode = 1;
        });
      });
  } catch (error) {
    await close();
    throw error;
  }
}

bootstrap().catch((error: unknown) => {
  logger.fatal('worker.startup.failed', {
    code:
      stage === 'log_config'
        ? 'INVALID_LOG_LEVEL'
        : error instanceof WorkerConfigError
          ? error.code
          : 'STARTUP_FAILED',
    operation: stage,
  });
  process.exitCode = 1;
});
