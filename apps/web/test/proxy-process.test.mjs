import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';

import { startProcess } from '@flowboard/config-jest/process';

test('proxy smoke process can reach only its explicitly permitted local upstream', async (t) => {
  const server = createServer((_request, response) => response.end('fixture'));
  server.listen(0, 'localhost');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();

    return new Promise((resolve) => server.close(resolve));
  });
  const origin = `http://localhost:${server.address().port}`;
  const script = `
    const response = await fetch(process.env.TEST_UPSTREAM);
    console.log('allowed:' + await response.text());
    const blocked = new URL(process.env.TEST_UPSTREAM);
    blocked.port = blocked.port === '54321' ? '54322' : '54321';
    try { await fetch(blocked); process.exit(2); }
    catch (error) { console.log(error.cause?.message ?? error.message); }
  `;
  const runtime = startProcess(['--input-type=module', '--eval', script], {
    outboundOrigins: [origin],
    env: { TEST_UPSTREAM: origin },
  });
  t.after(() => runtime.stop());
  await runtime.waitFor(/allowed:fixture/);
  await runtime.exited;
  assert.match(runtime.output(), /Unexpected outbound connection/);
});
