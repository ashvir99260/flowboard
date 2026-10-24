import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { TextEncoder } from 'node:util';

import { EventChannelName } from '@flowboard/contracts';
import {
  createDatabase,
  createOutboxRepository,
  DemoAccounts,
  DemoPassword,
  initializeDatabase,
  seedDemoData,
} from '@flowboard/database';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import { Redis } from 'ioredis';
import { SignJWT } from 'jose';
import { io } from 'socket.io-client';
import request from 'supertest';

import { createApplication } from '../../../dist/application.js';
import { readAuthSettings } from '../../../dist/modules/auth/auth.config.js';
import { createAuthRuntime } from '../../../dist/modules/auth/runtime.js';
import { runtimeProbe } from '../../../dist/modules/platform/dependency-probe.js';
import {
  AuthTestOrigin,
  AuthTestSecret,
  claimsOf,
  cookieOf,
} from '../../../test/common/auth-fixtures.mjs';
import { startInfrastructure } from '../../../test/common/infrastructure.mjs';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const apps = [];
const sockets = [];
const sessions = {};
let infrastructure;
let outbox;
let publisher;
const api = () => request(apps[0].app.getHttpServer());
const headers = (name = 'Alice') => ({ Authorization: `Bearer ${sessions[name].token}` });
async function until(predicate) {
  for (let n = 0; n < 200; n++) {
    if (await predicate()) return;

    await setTimeout(30);
  }
  throw new Error('Realtime condition was not reached');
}
async function connect(name = 'Alice', server = 0, options = {}) {
  const socket = io(apps[server].origin, {
    transports: ['websocket'],
    reconnection: false,
    auth: { token: sessions[name].token },
    extraHeaders: { Origin: AuthTestOrigin },
    ...options,
  });
  sockets.push(socket);
  await once(socket, 'connect', { signal: AbortSignal.timeout(3000) });

  return socket;
}
const subscribe = (socket, listId) =>
  new Promise((resolve) => socket.emit('list.subscribe', { listId }, resolve));
beforeAll(async () => {
  infrastructure = await startInfrastructure();
  await initializeDatabase({ databaseUrl: infrastructure.databaseUrl });
  await seedDemoData(infrastructure.databaseUrl);
  publisher = new Redis(infrastructure.redisUrl);
  publisher.on('error', () => {});
  outbox = createOutboxRepository(infrastructure.databaseUrl);
  for (let n = 0; n < 2; n++) {
    const auth = createAuthRuntime(
      infrastructure.databaseUrl,
      infrastructure.redisUrl,
      readAuthSettings({ AUTH_SECRET: AuthTestSecret, AUTH_ALLOWED_ORIGINS: AuthTestOrigin }),
    );
    const { app } = await createApplication(
      runtimeProbe(infrastructure.databaseUrl, infrastructure.redisUrl),
      {
        auth,
        database: createDatabase(infrastructure.databaseUrl),
        realtime: { redisUrl: infrastructure.redisUrl },
      },
    );
    await app.listen(0, 'localhost');
    apps.push({ app, origin: `http://localhost:${app.getHttpServer().address().port}` });
  }
  await until(
    async () =>
      (await request(apps[0].app.getHttpServer()).get('/health/ready')).status === 200 &&
      (await request(apps[1].app.getHttpServer()).get('/health/ready')).status === 200,
  );
  for (const account of DemoAccounts) {
    const result = await api()
      .post('/v1/auth/login')
      .set('Origin', AuthTestOrigin)
      .send({ email: account.email, password: DemoPassword });
    expect(result.status).toBe(200);
    sessions[account.name] = { token: result.body.data.accessToken, cookie: cookieOf(result) };
  }
}, 60000);
afterAll(async () => {
  sockets.forEach((socket) => socket.disconnect());
  await Promise.all(apps.map(({ app }) => app.close()));
  publisher?.disconnect();
  await outbox?.close();
  await infrastructure?.close();
});

test('handshakes reject missing, forged and wrong-origin credentials', async () => {
  for (const options of [
    { auth: {} },
    { auth: { token: 'forged' } },
    { extraHeaders: { Origin: 'https://evil.test' } },
    { query: { token: sessions.Alice.token } },
  ]) {
    const socket = io(apps[0].origin, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token: sessions.Alice.token },
      extraHeaders: { Origin: AuthTestOrigin },
      ...options,
    });
    sockets.push(socket);
    await once(socket, 'connect_error');
    expect(socket.connected).toBe(false);
  }
});

test('list subscriptions use live central permissions and strict input', async () => {
  const bob = await connect('Bob');
  expect(await subscribe(bob, id(221))).toEqual({ ok: true });
  for (const [input, code] of [
    [{ listId: id(222) }, 'FORBIDDEN'],
    [{ listId: id(321) }, 'NOT_FOUND'],
    [{ listId: id(211) }, 'VALIDATION_FAILED'],
    [{ listId: id(221), workspaceId: id(1) }, 'VALIDATION_FAILED'],
  ]) {
    const error = once(bob, 'exception');
    bob.emit('list.subscribe', input);
    expect((await error)[0]).toMatchObject({ error: { code } });
  }
  bob.disconnect();
});

async function update(taskId = id(700)) {
  const current = (await api().get(`/v1/tasks/${taskId}`).set(headers())).body;
  const changed = await api()
    .patch(`/v1/tasks/${taskId}`)
    .set(headers())
    .send({
      title: `Realtime ${current.data.version}`,
      expectedVersion: current.data.version,
      expectedConfigVersion: current.configVersion,
    });
  expect(changed.status).toBe(200);
  const events = await outbox.claim({ leaseMs: 1000, limit: 100 });
  const event = events.find(
    (entry) => entry.aggregateId === taskId && entry.aggregateVersion === changed.body.data.version,
  );
  expect(event).toBeDefined();

  const { attempts: _attempts, leaseToken: _leaseToken, ...record } = event;

  return record;
}
async function ingress(event, server = 0) {
  const { RealtimeService } = await import('../../../dist/modules/realtime/realtime.service.js');
  await apps[server].app.get(RealtimeService).acceptWorkerEvent(event);
}

test('Redis adapter reaches another API, duplicates are suppressed, payloads are minimal', async () => {
  const alice = await connect('Alice', 0);
  const bob = await connect('Bob', 1);
  await subscribe(alice, id(221));
  await subscribe(bob, id(221));
  const a = [],
    b = [];
  alice.on('invalidate', (event) => a.push(event));
  bob.on('invalidate', (event) => b.push(event));
  const event = await update();
  await ingress(event);
  await until(() => a.length === 1 && b.length === 1);
  await ingress(event, 1);
  await ingress(event);
  await setTimeout(150);
  expect(a).toEqual([{ kind: 'list', listId: id(221), eventId: event.id }]);
  expect(b).toEqual(a);
  alice.disconnect();
  bob.disconnect();
});

test('revoking a grant removes rooms and stops the next task invalidation', async () => {
  const bob = await connect('Bob', 1);
  await subscribe(bob, id(221));
  const received = [];
  bob.on('invalidate', (event) => received.push(event));
  const current = (
    await api()
      .get(`/v1/tasks/${id(700)}`)
      .set(headers())
  ).body;
  const denied = await api()
    .put(`/v1/nodes/${id(221)}/grants`)
    .set(headers())
    .send({ userId: id(102), mode: 'deny', expectedConfigVersion: current.configVersion });
  expect(denied.status).toBe(200);
  await ingress(await update());
  await until(() => received.some((event) => event.kind === 'resync'));
  expect(received.some((event) => event.kind === 'list')).toBe(false);
  const error = once(bob, 'exception');
  bob.emit('list.subscribe', { listId: id(221) });
  expect((await error)[0]).toMatchObject({ error: { code: 'FORBIDDEN' } });
  const config = (
    await api()
      .get(`/v1/tasks/${id(700)}`)
      .set(headers())
  ).body.configVersion;
  expect(
    (
      await api()
        .delete(`/v1/nodes/${id(221)}/grants/${id(102)}`)
        .set(headers())
        .send({ expectedConfigVersion: config })
    ).status,
  ).toBe(204);
  bob.disconnect();
});

test('verified short-lived JWT expires the socket even while the refresh family remains live', async () => {
  const claims = claimsOf(sessions.Alice.token);
  const token = await new SignJWT({ sid: claims.sid, workspaceId: claims.workspaceId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer('flowboard')
    .setAudience('flowboard-api')
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 2)
    .sign(new TextEncoder().encode(AuthTestSecret));
  const socket = await connect('Alice', 0, { auth: { token } });
  await subscribe(socket, id(221));
  await once(socket, 'disconnect');
  expect(socket.connected).toBe(false);
});

test('worker Redis publication reaches both instances once and accepts canonical UUID casing', async () => {
  const alice = await connect('Alice');
  const bob = await connect('Bob', 1);
  await subscribe(alice, id(221).toUpperCase());
  await subscribe(bob, id(221));
  const a = [],
    b = [];
  alice.on('invalidate', (value) => a.push(value));
  bob.on('invalidate', (value) => b.push(value));
  const event = await update();
  await publisher.publish(EventChannelName, JSON.stringify(event));
  await publisher.publish(EventChannelName, JSON.stringify(event));
  await until(() => a.length === 1 && b.length === 1);
  expect(a).toEqual(b);
  expect(a[0]).toEqual({ kind: 'list', listId: id(221), eventId: event.id });
  alice.disconnect();
  bob.disconnect();
});

test('moving into a private list reveals no destination or contents to a source-only viewer', async () => {
  const bob = await connect('Bob', 1);
  await subscribe(bob, id(221));
  const events = [];
  bob.on('invalidate', (event) => events.push(event));
  const current = (
    await api()
      .get(`/v1/tasks/${id(702)}`)
      .set(headers())
  ).body;
  const moved = await api()
    .post(`/v1/tasks/${id(702)}/move`)
    .set(headers())
    .send({
      destinationListId: id(222),
      placement: { edge: 'end' },
      customFields: { team: id(612) },
      expectedVersion: current.data.version,
      expectedConfigVersion: current.configVersion,
    });
  expect(moved.status).toBe(200);
  const records = await outbox.claim({ leaseMs: 1000, limit: 100 });
  const {
    attempts: _attempts,
    leaseToken: _leaseToken,
    ...event
  } = records.find((item) => item.aggregateId === id(702));
  await ingress(event);
  await until(() => events.length === 1);
  expect(events).toEqual([{ kind: 'list', listId: id(221), eventId: event.id }]);
  expect(JSON.stringify(events)).not.toContain(id(222));
  expect(JSON.stringify(events)).not.toContain(id(702));
  bob.disconnect();
});

test('Redis subscriber loss disconnects live clients and restores fanout after reconnection', async () => {
  const socket = await connect('Alice');
  await subscribe(socket, id(221));
  const disconnected = once(socket, 'disconnect');
  await publisher.client('KILL', 'TYPE', 'pubsub');
  await disconnected;
  await until(async () => (await api().get('/health/ready')).status === 200);
  const recovered = await connect('Alice', 1);
  await subscribe(recovered, id(221));
  const received = once(recovered, 'invalidate', { signal: AbortSignal.timeout(5000) });
  const event = await update();
  await publisher.publish(EventChannelName, JSON.stringify(event));
  expect((await received)[0]).toEqual({ kind: 'list', listId: id(221), eventId: event.id });
  recovered.disconnect();
});

test('revoked refresh sessions lose sockets even if their signed JWT has time remaining', async () => {
  const login = await api()
    .post('/v1/auth/login')
    .set('Origin', AuthTestOrigin)
    .send({ email: 'alice@example.com', password: DemoPassword });
  const socket = await connect('Alice', 0, { auth: { token: login.body.data.accessToken } });
  await subscribe(socket, id(221));
  const disconnected = once(socket, 'disconnect', { signal: AbortSignal.timeout(5000) });
  expect(
    (
      await api()
        .post('/v1/auth/logout')
        .set('Origin', AuthTestOrigin)
        .set('Cookie', cookieOf(login))
    ).status,
  ).toBe(204);
  await ingress(await update());
  await disconnected;
});

test('API starts unready during a realtime Redis outage and later restores the adapter', async () => {
  const { createServer, createConnection } = await import('node:net');
  const reserve = createServer();
  reserve.listen(0, 'localhost');
  await once(reserve, 'listening');
  const port = reserve.address().port;
  await new Promise((resolve) => reserve.close(resolve));
  const target = new URL(infrastructure.redisUrl);
  const peers = new Set();
  const proxy = createServer((client) => {
    const upstream = createConnection({ port: Number(target.port), host: target.hostname });
    peers.add(client);
    peers.add(upstream);
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.pipe(upstream);
    upstream.pipe(client);
  });
  const auth = createAuthRuntime(
    infrastructure.databaseUrl,
    infrastructure.redisUrl,
    readAuthSettings({ AUTH_SECRET: AuthTestSecret, AUTH_ALLOWED_ORIGINS: AuthTestOrigin }),
  );
  const { app } = await createApplication(
    runtimeProbe(infrastructure.databaseUrl, infrastructure.redisUrl),
    {
      auth,
      database: createDatabase(infrastructure.databaseUrl),
      realtime: { redisUrl: `redis://localhost:${port}` },
    },
  );
  try {
    await app.listen(0, 'localhost');
    expect((await request(app.getHttpServer()).get('/health/ready')).status).toBe(503);
    proxy.listen(port, 'localhost');
    await once(proxy, 'listening');
    await until(
      async () => (await request(app.getHttpServer()).get('/health/ready')).status === 200,
    );
    const peer = await connect('Alice', 1);
    await subscribe(peer, id(221));
    const received = once(peer, 'invalidate', { signal: AbortSignal.timeout(5000) });
    const { RealtimeService } = await import('../../../dist/modules/realtime/realtime.service.js');
    const event = await update();
    await app.get(RealtimeService).acceptWorkerEvent(event);
    expect((await received)[0]).toEqual({ kind: 'list', listId: id(221), eventId: event.id });
    peer.disconnect();
  } finally {
    await app.close();
    for (const peer of peers) peer.destroy();
    if (proxy.listening) await new Promise((resolve) => proxy.close(resolve));
  }
});

test('timed-out adapter publication reconnects instead of rejecting unobserved promises', async () => {
  const socket = await connect('Alice');
  await subscribe(socket, id(221));
  const event = await update();
  const disconnected = once(socket, 'disconnect', { signal: AbortSignal.timeout(6000) });
  infrastructure.pauseRedis();
  await ingress(event);
  await disconnected;
  await until(async () => (await api().get('/health/ready')).status === 200);
});

test('concurrent subscription packets cannot exceed the per-socket limit', async () => {
  const socket = await connect('Alice');
  const listIds = [];
  let revision = (
    await api()
      .get(`/v1/tasks/${id(700)}`)
      .set(headers())
  ).body.configVersion;
  for (let index = 0; index < 21; index++) {
    const result = await api()
      .post('/v1/nodes')
      .set(headers())
      .send({
        name: `Subscription bound ${index}`,
        type: 'list',
        parentId: id(211),
        expectedConfigVersion: revision,
      });
    expect(result.status).toBe(201);
    revision = result.body.configVersion;
    listIds.push(result.body.data.id);
  }
  let accepted = 0;
  let rejected = 0;
  socket.on('exception', () => rejected++);
  for (const listId of listIds) socket.emit('list.subscribe', { listId }, () => accepted++);
  await until(() => accepted + rejected === 21);
  expect(accepted).toBe(20);
  expect(rejected).toBe(1);
  socket.disconnect();
});
