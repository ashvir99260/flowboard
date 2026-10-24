import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createConnection } from 'node:net';
import test, { after, before } from 'node:test';

import { startLocalCommand } from '@flowboard/config-jest/local-command';

import { workerInfrastructure } from './infrastructure.mjs';

let infrastructure;
before(async () => {
  infrastructure = await workerInfrastructure();
});
after(() => infrastructure?.close());

const packageDirectory = new URL('../', import.meta.url);
const cleanEnvironment = { HOST: undefined, LOG_LEVEL: undefined, PORT: undefined };

for (const scriptName of ['dev', 'start']) {
  test(`worker ${scriptName} loads and validates its local file`, async (t) => {
    const runtime = await startLocalCommand(packageDirectory, scriptName, {
      outboundOrigins: infrastructure.outboundOrigins,
      env: { ...infrastructure.env, ...cleanEnvironment, PORT: '0' },
      envFile: 'LOG_LEVEL=invalid-private-value\n',
    });
    t.after(() => runtime.stop(null, 1));
    await runtime.waitFor(/"event":"worker.(?:started|startup.failed)"/);
    assert.match(runtime.output(), /"code":"INVALID_LOG_LEVEL"/);
    assert.equal((await runtime.exited).code, 1);
    assert.doesNotMatch(runtime.output(), /invalid-private-value/);
  });

  for (const [label, envFile] of [
    ['process values override local values', 'PORT=invalid\nLOG_LEVEL=invalid\nHOST=invalid\n'],
    ['a missing file uses process values', undefined],
  ]) {
    test(`worker ${scriptName}: ${label}`, async (t) => {
      const runtime = await startLocalCommand(packageDirectory, scriptName, {
        outboundOrigins: infrastructure.outboundOrigins,
        env: { ...infrastructure.env, HOST: 'localhost', LOG_LEVEL: 'info', PORT: '0' },
        envFile,
      });
      t.after(() => runtime.stop());
      const [line] = await runtime.waitFor(/\{[^\n]*"event":"worker.started"[^\n]*\}/);
      const { port } = JSON.parse(line);
      const connection = createConnection({ host: 'localhost', port });
      t.after(() => connection.destroy());
      await once(connection, 'connect');
      connection.write('GET /health/live HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
      connection.resume();
      await once(connection, 'end');
    });
  }
}
