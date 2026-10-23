import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import test from 'node:test';

import { startProcess } from '@flowboard/config-jest/process';

const cwd = new URL('../', import.meta.url);

test('worker defaults to localhost liveness and stops without claiming queue readiness', async (t) => {
  const runtime = startProcess(['dist/main.js'], { cwd, env: { HOST: undefined, PORT: '0' } });
  t.after(() => runtime.stop());
  const [line] = await runtime.waitFor(/\{[^\n]*"event":"worker.started"[^\n]*\}/);
  const { port } = JSON.parse(line);
  assert.match(runtime.output(), /"outcome":"process_only"/);
  const connection = createConnection({ host: 'localhost', port: Number(port) });
  t.after(() => connection.destroy());
  await once(connection, 'connect');
  connection.resume();
  await once(connection, 'end');
});

for (const port of ['not-a-port', '65536']) {
  test(`worker rejects invalid PORT=${port}`, async (t) => {
    const runtime = startProcess(['dist/main.js'], { cwd, env: { PORT: port } });
    t.after(() => runtime.stop(null, 1));
    const { code } = await runtime.exited;
    assert.equal(code, 1);
    assert.match(runtime.output(), /"code":"INVALID_PORT"/);
  });
}

test('worker closes a half-open liveness connection during shutdown', async (t) => {
  const runtime = startProcess(['dist/main.js'], { cwd, env: { HOST: 'localhost', PORT: '0' } });
  let client;
  t.after(() => client?.destroy());
  t.after(() => runtime.stop());
  const [line] = await runtime.waitFor(/\{[^\n]*"event":"worker.started"[^\n]*\}/);
  const { port } = JSON.parse(line);
  client = createConnection({ host: 'localhost', port: Number(port), allowHalfOpen: true });
  client.resume();
  await once(client, 'end');
  await runtime.stop();
});

test('worker rejects invalid log configuration without revealing it', async (t) => {
  const runtime = startProcess(['dist/main.js'], { cwd, env: { LOG_LEVEL: 'secret-setting' } });
  t.after(() => runtime.stop(null, 1));
  assert.equal((await runtime.exited).code, 1);
  assert.match(runtime.output(), /"code":"INVALID_LOG_LEVEL"/);
  assert.doesNotMatch(runtime.output(), /secret-setting/);
});
