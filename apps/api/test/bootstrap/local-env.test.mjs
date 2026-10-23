import assert from 'node:assert/strict';
import test from 'node:test';

import { startLocalCommand } from '@flowboard/config-jest/local-command';

const packageDirectory = new URL('../../', import.meta.url);
const cleanEnvironment = {
  API_DOCS: undefined,
  AUTH_ALLOW_INSECURE_HTTP: undefined,
  AUTH_ALLOWED_ORIGINS: undefined,
  AUTH_SECRET: undefined,
  DATABASE_URL: undefined,
  DATABASE_URL_UNPOOLED: undefined,
  DEMO_SEED: undefined,
  HOST: undefined,
  LOG_LEVEL: 'info',
  PORT: undefined,
  REDIS_URL: undefined,
};
const envFile =
  'DATABASE_URL=postgresql://local.invalid/fixture\nREDIS_URL=redis://local.invalid\nPORT=0\n';

for (const scriptName of ['dev', 'start']) {
  for (const [label, contents, overrides, stage] of [
    ['loads its local file before validating auth', envFile, {}, 'auth_config'],
    ['lets process values override the file', envFile, { PORT: 'invalid' }, 'application_config'],
    ['permits a missing optional file', undefined, {}, 'application_config'],
  ]) {
    test(`API ${scriptName} ${label}`, async (t) => {
      const runtime = await startLocalCommand(packageDirectory, scriptName, {
        env: { ...cleanEnvironment, ...overrides },
        envFile: contents,
      });
      t.after(() => runtime.stop(null, 1));
      assert.equal((await runtime.exited).code, 1);
      assert.match(runtime.output(), new RegExp(`"operation":"${stage}"`));
      assert.doesNotMatch(runtime.output(), /local\.invalid/);
    });
  }
}
