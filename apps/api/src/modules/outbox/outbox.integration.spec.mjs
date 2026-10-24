import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

import { EventJobReferenceSchema, EventQueueName } from '@flowboard/contracts';
import { createOutboxRepository, DemoPassword, seedDemoData } from '@flowboard/database';
import { SilentLogger } from '@flowboard/logger';
import { afterEach, expect, test } from '@jest/globals';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import request from 'supertest';

import { createEventPublisher } from '../../../dist/modules/outbox/outbox.publisher.js';
import { createOutboxRuntime } from '../../../dist/modules/outbox/outbox.runtime.js';
import { createOutboxDispatcher } from '../../../dist/modules/outbox/outbox.service.js';
import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin } from '../../../test/common/auth-fixtures.mjs';

const close = [];
afterEach(async () => {
  for (const cleanup of close.splice(0).reverse()) await cleanup();
});
const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function setup() {
  const fixture = await startTestApplication({ auth: true });
  close.push(() => fixture.close());
  await seedDemoData(fixture.infrastructure.databaseUrl);
  const api = () => request(fixture.app.getHttpServer());
  const login = await api()
    .post('/v1/auth/login')
    .set('Origin', AuthTestOrigin)
    .send({ email: 'alice@example.com', password: DemoPassword });
  expect(login.status).toBe(200);
  const headers = { Authorization: `Bearer ${login.body.data.accessToken}` };
  const repository = createOutboxRepository(fixture.infrastructure.databaseUrl);
  close.push(() => repository.close());
  const redis = new Redis(fixture.infrastructure.redisUrl, { maxRetriesPerRequest: 0 });
  redis.on('error', () => {});
  const queue = new Queue(EventQueueName, { connection: redis });
  close.push(async () => {
    await queue.close();
    redis.disconnect();
  });
  await queue.waitUntilReady();
  const createTask = async () => {
    const response = await api()
      .post(`/v1/lists/${id(221)}/tasks`)
      .set(headers)
      .send({
        title: 'Outbox task',
        statusId: id(400),
        customFields: { effort: 1 },
        expectedConfigVersion: 1,
      });
    expect(response.status).toBe(201);

    return response.body;
  };
  const publisher = createEventPublisher(fixture.infrastructure.redisUrl);
  close.push(() => publisher.close());

  return { fixture, api, headers, repository, queue, createTask, publisher };
}
async function eventually(action, predicate) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const value = await action();
    if (predicate(value)) return value;

    await setTimeout(30);
  }
  throw new Error('Outbox condition did not become true');
}
const dispatchUntil = (dispatcher, queue, count) =>
  eventually(
    async () => {
      await dispatcher.runOnce();

      return queue.getWaitingCount();
    },
    (value) => value === count,
  );

test('all persisted event kinds enqueue stable tenant references without requiring the latest aggregate version', async () => {
  const { api, headers, repository, queue, createTask, publisher } = await setup();
  const created = await createTask();
  expect(
    (
      await api()
        .patch(`/v1/tasks/${created.data.id}`)
        .set(headers)
        .send({ expectedConfigVersion: 1, expectedVersion: 1, title: 'Later title' })
    ).status,
  ).toBe(200);
  expect(
    (
      await api()
        .post('/v1/nodes')
        .set(headers)
        .send({ expectedConfigVersion: 1, name: 'Events space', parentId: null, type: 'space' })
    ).status,
  ).toBe(201);
  const dispatcher = createOutboxDispatcher(repository, publisher);
  await dispatchUntil(dispatcher, queue, 4);
  const jobs = await queue.getWaiting();
  expect(new Set(jobs.map((job) => job.id)).size).toBe(4);
  for (const job of jobs) {
    expect(EventJobReferenceSchema.parse(job.data)).toEqual(job.data);
    expect(job.data.workspaceId).toBe(id(1));
    expect(job.id).toBe(job.data.eventId);
  }
  expect(await queue.getCompletedCount()).toBe(0);
});

test('Redis unavailable at producer startup retains intent and queues after recovery', async () => {
  const { fixture, repository, queue, createTask, publisher } = await setup();
  await createTask();
  await publisher.close();
  const name = fixture.infrastructure.names.find((value) =>
    value.startsWith('flowboard-api-redis-'),
  );
  execFileSync('docker', ['pause', name], { stdio: 'pipe' });
  const cold = createEventPublisher(fixture.infrastructure.redisUrl);
  close.push(() => cold.close());
  const dispatcher = createOutboxDispatcher(repository, cold);
  try {
    const started = Date.now();
    expect(await dispatcher.runOnce()).toBe(0);
    expect(Date.now() - started).toBeLessThan(3000);
  } finally {
    execFileSync('docker', ['unpause', name], { stdio: 'pipe' });
  }
  await dispatchUntil(dispatcher, queue, 1);
});

test('Redis interruption during enqueue returns promptly and recovers every committed event', async () => {
  const { fixture, repository, queue, createTask, publisher } = await setup();
  const dispatcher = createOutboxDispatcher(repository, publisher);
  await createTask();
  await dispatchUntil(dispatcher, queue, 1);
  await createTask();
  const name = fixture.infrastructure.names.find((value) =>
    value.startsWith('flowboard-api-redis-'),
  );
  execFileSync('docker', ['pause', name], { stdio: 'pipe' });
  try {
    const started = Date.now();
    expect(await dispatcher.runOnce()).toBe(0);
    expect(Date.now() - started).toBeLessThan(3000);
  } finally {
    execFileSync('docker', ['unpause', name], { stdio: 'pipe' });
  }
  await dispatchUntil(dispatcher, queue, 2);
});

test('a lost acknowledgment after enqueue retries the same job without a duplicate', async () => {
  const { repository, queue, createTask, publisher } = await setup();
  await createTask();
  let fail = true;
  const interrupted = {
    ...repository,
    markQueued: async (...args) => {
      if (fail) {
        fail = false;
        throw new Error('lost acknowledgment');
      }

      return repository.markQueued(...args);
    },
  };
  const dispatcher = createOutboxDispatcher(interrupted, publisher);
  await dispatchUntil(dispatcher, queue, 1);
  await eventually(
    () => dispatcher.runOnce(),
    (count) => count === 1,
  );
  expect(await queue.getWaitingCount()).toBe(1);
});

test('two real dispatchers and queued-event rechecks keep one job per committed event', async () => {
  const { fixture, repository, queue, createTask, publisher } = await setup();
  for (let i = 0; i < 4; i++) await createTask();
  const other = createOutboxRepository(fixture.infrastructure.databaseUrl);
  close.push(() => other.close());
  const settings = { batchSize: 2, leaseMs: 30000, pollMs: 500, recheckMs: 0 };
  const first = createOutboxDispatcher(repository, publisher, undefined, settings);
  const second = createOutboxDispatcher(other, publisher, undefined, settings);
  await eventually(
    async () => {
      await Promise.all([first.runOnce(), second.runOnce()]);

      return queue.getWaitingCount();
    },
    (count) => count === 4,
  );
  await first.runOnce();
  await second.runOnce();
  expect(await queue.getWaitingCount()).toBe(4);
});

test('runtime polling starts once and shuts down without waiting on disconnected Redis', async () => {
  const { fixture, queue, createTask, publisher } = await setup();
  await createTask();
  await publisher.close();
  const runtime = createOutboxRuntime(
    fixture.infrastructure.databaseUrl,
    fixture.infrastructure.redisUrl,
    undefined,
    { pollMs: 20 },
  );
  close.push(() => runtime.close());
  runtime.start();
  runtime.start();
  await eventually(
    () => queue.getWaitingCount(),
    (count) => count === 1,
  );
  const name = fixture.infrastructure.names.find((value) =>
    value.startsWith('flowboard-api-redis-'),
  );
  execFileSync('docker', ['pause', name], { stdio: 'pipe' });
  try {
    const started = Date.now();
    await runtime.close();
    expect(Date.now() - started).toBeLessThan(4000);
  } finally {
    execFileSync('docker', ['unpause', name], { stdio: 'pipe' });
  }
});

test('runtime shutdown interrupts an active enqueue while Redis is paused', async () => {
  const { fixture, queue, createTask, publisher } = await setup();
  await publisher.close();
  let attempts = 0;
  const logger = {
    ...SilentLogger,
    debug: (event) => {
      if (event === 'outbox.event.dispatching') attempts++;
    },
  };
  const runtime = createOutboxRuntime(
    fixture.infrastructure.databaseUrl,
    fixture.infrastructure.redisUrl,
    logger,
    { pollMs: 20 },
  );
  close.push(() => runtime.close());
  runtime.start();
  await createTask();
  await eventually(
    () => queue.getWaitingCount(),
    (count) => count === 1,
  );
  const before = attempts;
  const name = fixture.infrastructure.names.find((value) =>
    value.startsWith('flowboard-api-redis-'),
  );
  execFileSync('docker', ['pause', name], { stdio: 'pipe' });
  try {
    await createTask();
    await eventually(
      async () => attempts,
      (count) => count > before,
    );
    const started = Date.now();
    await runtime.close();
    expect(Date.now() - started).toBeLessThan(4000);
  } finally {
    execFileSync('docker', ['unpause', name], { stdio: 'pipe' });
  }
});
