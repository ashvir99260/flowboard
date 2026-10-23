import assert from 'node:assert/strict';
import test from 'node:test';

import { startProcess } from '@flowboard/config-jest/process';

const cwd = new URL('../', import.meta.url);

test('Nest starts without infrastructure, has no domain endpoints, and stops cleanly', async (t) => {
  const runtime = startProcess(['dist/main.js'], { cwd, env: { HOST: '127.0.0.1', PORT: '0' } });
  // Nest re-emits SIGTERM after its shutdown hooks complete.
  t.after(() => runtime.stop('SIGTERM'));
  const [, url] = await runtime.waitFor(/\[api\] Listening at (http:\/\/\S+)/);
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  assert.equal(response.status, 404);
  const domainResponse = await fetch(`${url}/v1/tasks`, { signal: AbortSignal.timeout(5_000) });
  assert.equal(domainResponse.status, 404);
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
      DATABASE_URL: 'postgresql://test:never-print-this@127.0.0.1:1/unavailable',
      DATABASE_URL_UNPOOLED: 'postgresql://test:never-print-this@127.0.0.1:1/unavailable',
      HOST: '127.0.0.1',
      PORT: '0',
    },
  });
  t.after(() => runtime.stop(null, 1));
  const { code } = await runtime.exited;
  assert.equal(code, 1);
  assert.match(runtime.output(), /Database initialization failed/);
  assert.doesNotMatch(runtime.output(), /Listening at|never-print-this/);
});
