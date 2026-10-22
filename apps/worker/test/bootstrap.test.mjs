import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import test from 'node:test';

import { startProcess } from '@flowboard/config-jest/process';

const cwd = new URL('../', import.meta.url);

test('worker exposes process liveness and stops without claiming queue readiness', async (t) => {
  const runtime = startProcess(['dist/main.js'], { cwd, env: { PORT: '0', HOST: '127.0.0.1' } });
  t.after(() => runtime.stop());
  const [, port] = await runtime.waitFor(/\[worker\] Process listening on port (\d+)/);
  assert.match(runtime.output(), /Queue processing is not implemented/);
  const connection = createConnection({ host: '127.0.0.1', port: Number(port) });
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
    assert.match(runtime.output(), /PORT must be an integer between 0 and 65535/);
  });
}

test('worker closes a half-open liveness connection during shutdown', async (t) => {
  const runtime = startProcess(['dist/main.js'], { cwd, env: { PORT: '0', HOST: '127.0.0.1' } });
  let client;
  t.after(() => client?.destroy());
  t.after(() => runtime.stop());
  const [, port] = await runtime.waitFor(/\[worker\] Process listening on port (\d+)/);
  client = createConnection({ host: '127.0.0.1', port: Number(port), allowHalfOpen: true });
  client.resume();
  await once(client, 'end');
  await runtime.stop();
});
