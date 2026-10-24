import { setTimeout } from 'node:timers/promises';

import { createDatabase, initializeDatabase } from '@flowboard/database';

import { createApplication } from '../../dist/application.js';
import { readAuthSettings } from '../../dist/modules/auth/auth.config.js';
import { createAuthRuntime } from '../../dist/modules/auth/runtime.js';
import { runtimeProbe } from '../../dist/modules/platform/dependency-probe.js';

import { AuthTestOrigin, AuthTestSecret } from './auth-fixtures.mjs';
import { closeOnce } from './cleanup.mjs';
import { startInfrastructure } from './infrastructure.mjs';

// A newly constructed probe connects asynchronously even when the servers are ready.
// Match a real service's startup readiness wait before handing its fixture to tests.
async function waitForReadiness(probe) {
  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      await probe.check();

      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;

      await setTimeout(25);
    }
  }
}

// Every call owns independent containers; the module has no mutable suite state or hooks.
export async function startTestApplication({
  auth = false,
  exposeDocs = false,
  insecureHttp = false,
  logger,
  origin = AuthTestOrigin,
  secret = AuthTestSecret,
} = {}) {
  const infrastructure = await startInfrastructure();
  let app;
  let runtime;
  let probe;
  let database;
  let closePromise;
  const close = () =>
    (closePromise ??= (async () => {
      try {
        if (app) await app.close();
        else await Promise.allSettled([runtime?.close(), probe?.close(), database?.close()]);
      } finally {
        infrastructure.close();
      }
    })());
  try {
    await initializeDatabase({ databaseUrl: infrastructure.databaseUrl, logger });
    if (auth)
      runtime = createAuthRuntime(
        infrastructure.databaseUrl,
        infrastructure.redisUrl,
        readAuthSettings({
          AUTH_SECRET: secret,
          AUTH_ALLOWED_ORIGINS: origin,
          AUTH_ALLOW_INSECURE_HTTP: String(insecureHttp),
        }),
        logger,
      );

    if (runtime) runtime.close = closeOnce(runtime.close);

    probe = runtimeProbe(infrastructure.databaseUrl, infrastructure.redisUrl, logger);
    probe.close = closeOnce(probe.close);
    if (auth) database = createDatabase(infrastructure.databaseUrl, logger);

    ({ app } = await createApplication(probe, { auth: runtime, database, exposeDocs, logger }));
    await app.init();
    await waitForReadiness(probe);

    return { app, runtime, infrastructure, close };
  } catch (error) {
    await close();
    throw error;
  }
}
