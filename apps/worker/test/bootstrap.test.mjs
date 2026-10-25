import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createConnection, createServer } from 'node:net';
import test, { after, before } from 'node:test';
import { setTimeout } from 'node:timers/promises';

import { startProcess } from '@flowboard/config-jest/process';
import { createDatabase, seedDemoData } from '@flowboard/database';

import { workerInfrastructure } from './infrastructure.mjs';

const cwd = new URL('../', import.meta.url);
let infrastructure;
before(async () => {
  infrastructure = await workerInfrastructure();
});
after(() => infrastructure?.close());

test('worker serves localhost liveness and dependency readiness and stops cleanly', async (t) => {
  const runtime = startProcess(['dist/main.js'], {
    cwd,
    outboundOrigins: infrastructure.outboundOrigins,
    env: { ...infrastructure.env, HOST: undefined, PORT: '0' },
  });
  t.after(() => runtime.stop());
  const [line] = await runtime.waitFor(/\{[^\n]*"event":"worker.started"[^\n]*\}/);
  const { port } = JSON.parse(line);
  assert.match(runtime.output(), /"outcome":"activity_worker"/);
  await runtime.waitFor(/"event":"worker.ready"/);
  assert.match(runtime.output(), /"event":"outbox.started"/);
  assert.equal((await fetch(`http://localhost:${port}/health/ready`)).status, 200);
  const connection = createConnection({ host: 'localhost', port: Number(port) });
  t.after(() => connection.destroy());
  await once(connection, 'connect');
  connection.write('GET /health/live HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
  connection.resume();
  await once(connection, 'end');
  await runtime.stop();
  assert.match(runtime.output(), /"event":"outbox.stopped"/);
  assert.match(runtime.output(), /"event":"worker.stopped"/);
});

test('a failed HTTP bind closes the activity consumer and outbox dispatcher', async (t) => {
  const occupied = createServer();
  occupied.listen(0, 'localhost');
  await once(occupied, 'listening');
  t.after(() => occupied.close());
  const { port } = occupied.address();
  const runtime = startProcess(['dist/main.js'], {
    cwd,
    outboundOrigins: infrastructure.outboundOrigins,
    env: { ...infrastructure.env, HOST: 'localhost', PORT: String(port) },
  });
  t.after(() => runtime.stop(null, 1));
  assert.equal((await runtime.exited).code, 1);
  assert.match(runtime.output(), /"event":"worker.startup.failed"/);
  assert.match(runtime.output(), /"event":"outbox.stopped"/);
  assert.match(runtime.output(), /"event":"worker.stopped"/);
});

test('the standalone worker dispatches committed outbox records without an API process', async (t) => {
  await seedDemoData(infrastructure.databaseUrl);
  const database = createDatabase(infrastructure.databaseUrl);
  const runtime = startProcess(['dist/main.js'], {
    cwd,
    outboundOrigins: infrastructure.outboundOrigins,
    env: { ...infrastructure.env, PORT: '0' },
  });
  t.after(async () => {
    await Promise.all([runtime.stop(), database.close()]);
  });
  await runtime.waitFor(/"event":"worker.ready"/);
  const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const context = { actorUserId: id(101), workspaceId: id(1) };
  await database.write(context, (store) =>
    store.tasks.update(id(700), {
      statusId: id(401),
      expectedVersion: 1,
      expectedConfigVersion: 1,
    }),
  );
  const deadline = Date.now() + 10000;
  let activities = [];
  while (Date.now() < deadline) {
    activities = (
      await database.read(context, (store) => store.activities.list(id(700), { limit: 50 }))
    ).items;
    if (activities.length > 0) break;

    await setTimeout(50);
  }
  assert.equal(activities.length, 1);
  assert.equal(activities[0].payload.afterStatusId, id(401));
});

for (const port of ['not-a-port', '65536']) {
  test(`worker rejects invalid PORT=${port}`, async (t) => {
    const runtime = startProcess(['dist/main.js'], {
      cwd,
      outboundOrigins: infrastructure.outboundOrigins,
      env: { PORT: port },
    });
    t.after(() => runtime.stop(null, 1));
    const { code } = await runtime.exited;
    assert.equal(code, 1);
    assert.match(runtime.output(), /"code":"INVALID_PORT"/);
  });
}

test('worker closes a half-open liveness connection during shutdown', async (t) => {
  const runtime = startProcess(['dist/main.js'], {
    cwd,
    outboundOrigins: infrastructure.outboundOrigins,
    env: { ...infrastructure.env, HOST: 'localhost', PORT: '0' },
  });
  let client;
  t.after(() => client?.destroy());
  t.after(() => runtime.stop());
  const [line] = await runtime.waitFor(/\{[^\n]*"event":"worker.started"[^\n]*\}/);
  const { port } = JSON.parse(line);
  client = createConnection({ host: 'localhost', port: Number(port), allowHalfOpen: true });
  client.write('GET /health/live HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n');
  client.resume();
  await once(client, 'end');
  await runtime.stop();
});

test('worker rejects invalid log configuration without revealing it', async (t) => {
  const runtime = startProcess(['dist/main.js'], {
    cwd,
    outboundOrigins: infrastructure.outboundOrigins,
    env: { LOG_LEVEL: 'secret-setting' },
  });
  t.after(() => runtime.stop(null, 1));
  assert.equal((await runtime.exited).code, 1);
  assert.match(runtime.output(), /"code":"INVALID_LOG_LEVEL"/);
  assert.doesNotMatch(runtime.output(), /secret-setting/);
});
