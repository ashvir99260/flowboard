import assert from 'node:assert/strict';
import test from 'node:test';

import { startProcess } from '@flowboard/config-jest/process';

const cwd = new URL('../../', import.meta.url);

test('Nest refuses to start the HTTP platform without database configuration', async (t) => {
  const runtime = startProcess(['dist/main.js'], { cwd, env: { HOST: '127.0.0.1', PORT: '0' } });
  t.after(() => runtime.stop(null, 1));
  const { code } = await runtime.exited;
  assert.equal(code, 1);
  assert.match(runtime.output(), /DATABASE_URL is required/);
});

for (const port of ['not-a-port', '65536']) {
  test(`Nest rejects invalid PORT=${port}`, async (t) => {
    const runtime = startProcess(['dist/main.js'], { cwd, env: { PORT: port } });
    t.after(() => runtime.stop(null, 1));
    const { code } = await runtime.exited;
    assert.equal(code, 1);
    assert.match(runtime.output(), /PORT must be an integer between 0 and 65535/);
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
  assert.match(runtime.output(), /Database initialization failed/);
  assert.doesNotMatch(runtime.output(), /Listening at|never-print-this/);
});
