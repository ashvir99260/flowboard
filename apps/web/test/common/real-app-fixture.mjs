import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { startInfrastructure } from '@flowboard/config-jest/infrastructure';
import { startProcess } from '@flowboard/config-jest/process';

import { startWeb } from './proxy-fixture.mjs';

export async function startRealApp(t, { activityWorker = false, realtime = false } = {}) {
  const cleanups = [];
  t.after(async () => {
    const errors = [];
    for (const close of cleanups.toReversed()) {
      try {
        await close();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length)
      throw new AggregateError(
        errors,
        `Real application cleanup failed: ${errors.map((error) => (error instanceof Error ? error.message : String(error))).join('\n')}`,
      );
  });
  const infrastructure = await startInfrastructure();
  cleanups.push(() => infrastructure.close());
  const reservation = createServer();
  reservation.listen(0, 'localhost');
  await once(reservation, 'listening');
  cleanups.push(() =>
    reservation.listening ? new Promise((resolve) => reservation.close(resolve)) : undefined,
  );
  const apiPort = reservation.address().port;
  const apiOrigin = `http://localhost:${apiPort}`;
  const web = await startWeb(
    { after: (callback) => cleanups.push(callback) },
    apiOrigin,
    'localhost',
    process.env.FLOWBOARD_WEB_DEV_TEST === '1',
    realtime ? apiOrigin : '',
  );
  await new Promise((resolve, reject) =>
    reservation.close((error) => (error ? reject(error) : resolve())),
  );
  const database = new URL(infrastructure.databaseUrl);
  const redis = new URL(infrastructure.redisUrl);
  database.hostname = 'localhost';
  redis.hostname = 'localhost';
  const api = startProcess([fileURLToPath(new URL('../../../api/dist/main.js', import.meta.url))], {
    cwd: new URL('../../../api/', import.meta.url),
    outboundOrigins: [database.port, redis.port].flatMap((port) =>
      ['localhost', '127.0.0.1', '[::1]'].map((host) => `http://${host}:${port}`),
    ),
    env: {
      HOST: 'localhost',
      PORT: String(apiPort),
      NODE_ENV: 'test',
      DATABASE_URL: database.href,
      DATABASE_URL_UNPOOLED: database.href,
      REDIS_URL: redis.href,
      DEMO_SEED: 'true',
      API_DOCS: 'false',
      AUTH_SECRET: randomBytes(64).toString('base64url'),
      AUTH_ALLOWED_ORIGINS: web.origin,
      AUTH_ALLOW_INSECURE_HTTP: 'true',
      LOG_LEVEL: 'info',
    },
  });
  cleanups.push(async () => {
    await api.stop('SIGTERM');
    if (!api.output().includes('"event":"api.stopped"'))
      throw new Error('API did not report graceful shutdown');
  });
  await api.waitFor(/"event":"api.started"/, 60_000);
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const readiness = await fetch(`${apiOrigin}/health/ready`, {
      signal: AbortSignal.timeout(5000),
    });
    if (readiness.ok) {
      if (activityWorker || realtime) {
        const worker = startProcess(
          [fileURLToPath(new URL('../../../worker/dist/main.js', import.meta.url))],
          {
            cwd: new URL('../../../worker/', import.meta.url),
            outboundOrigins: [database.port, redis.port].flatMap((port) =>
              ['localhost', '127.0.0.1', '[::1]'].map((host) => `http://${host}:${port}`),
            ),
            env: {
              HOST: 'localhost',
              PORT: '0',
              DATABASE_URL: database.href,
              REDIS_URL: redis.href,
              LOG_LEVEL: 'info',
            },
          },
        );
        cleanups.push(() => worker.stop());
        await worker.waitFor(/"event":"worker.ready"/, 30000);
      }

      return { origin: web.origin, apiOrigin };
    }

    await setTimeout(100);
  }
  throw new Error(`Real API did not become ready.\n${api.output()}`);
}
