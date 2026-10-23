import assert from 'node:assert/strict';
import test from 'node:test';

import { startProcess } from '@flowboard/config-jest/process';

const cwd = new URL('../../', import.meta.url);

test('Nest refuses to start the HTTP platform without database configuration', async (t) => {
  const runtime = startProcess(['dist/main.js'], { cwd, env: { HOST: '127.0.0.1', PORT: '0' } });
  t.after(() => runtime.stop(null, 1));
  const { code } = await runtime.exited;
  assert.equal(code, 1);
  assert.match(runtime.output(), /"event":"api.startup.failed".*"operation":"application_config"/);
});

for (const port of ['not-a-port', '65536']) {
  test(`Nest rejects invalid PORT=${port}`, async (t) => {
    const runtime = startProcess(['dist/main.js'], { cwd, env: { PORT: port } });
    t.after(() => runtime.stop(null, 1));
    const { code } = await runtime.exited;
    assert.equal(code, 1);
    assert.match(
      runtime.output(),
      /"event":"api.startup.failed".*"operation":"application_config"/,
    );
  });
}

test('migration failure prevents listening and does not print credentials', async (t) => {
  const runtime = startProcess(['dist/main.js'], {
    cwd,
    env: {
      AUTH_ALLOW_INSECURE_HTTP: 'true',
      AUTH_ALLOWED_ORIGINS: 'http://localhost:3000',
      AUTH_SECRET: 'test-only-abcdefghijklmnopqrstuvwxyz123456',
      DATABASE_URL: 'postgresql://test:never-print-this@127.0.0.1:1/unavailable',
      DATABASE_URL_UNPOOLED: 'postgresql://test:never-print-this@127.0.0.1:1/unavailable',
      HOST: '127.0.0.1',
      PORT: '0',
      REDIS_URL: 'redis://127.0.0.1:1',
    },
  });
  t.after(() => runtime.stop(null, 1));
  const { code } = await runtime.exited;
  assert.equal(code, 1);
  assert.match(runtime.output(), /"event":"database.initialization.failed"/);
  assert.doesNotMatch(runtime.output(), /api.started|never-print-this/);
});

test('invalid log level fails without printing the supplied value', async (t) => {
  const runtime = startProcess(['dist/main.js'], { cwd, env: { LOG_LEVEL: 'secret-level' } });
  t.after(() => runtime.stop(null, 1));
  assert.equal((await runtime.exited).code, 1);
  assert.match(runtime.output(), /"operation":"log_config"/);
  assert.doesNotMatch(runtime.output(), /secret-level/);
});
