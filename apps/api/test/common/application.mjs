import { initializeDatabase } from '@flowboard/database';

import { createApplication } from '../../dist/application.js';
import { readAuthSettings } from '../../dist/auth/auth.config.js';
import { createAuthRuntime } from '../../dist/auth/runtime.js';
import { runtimeProbe } from '../../dist/platform/dependency-probe.js';

import { AuthTestOrigin, AuthTestSecret } from './auth-fixtures.mjs';
import { closeOnce } from './cleanup.mjs';
import { startInfrastructure } from './infrastructure.mjs';

// Every call owns independent containers; the module has no mutable suite state or hooks.
export async function startTestApplication({
  auth = false,
  logger,
  origin = AuthTestOrigin,
  secret = AuthTestSecret,
} = {}) {
  const infrastructure = await startInfrastructure();
  let app;
  let runtime;
  let probe;
  let closePromise;
  const close = () =>
    (closePromise ??= (async () => {
      try {
        if (app) await app.close();
        else await Promise.allSettled([runtime?.close(), probe?.close()]);
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
        readAuthSettings({ AUTH_SECRET: secret, AUTH_ALLOWED_ORIGINS: origin }),
        logger,
      );
    if (runtime) runtime.close = closeOnce(runtime.close);
    probe = runtimeProbe(infrastructure.databaseUrl, infrastructure.redisUrl, logger);
    probe.close = closeOnce(probe.close);
    ({ app } = await createApplication(probe, { auth: runtime, logger }));
    await app.init();
    return { app, runtime, infrastructure, close };
  } catch (error) {
    await close();
    throw error;
  }
}
