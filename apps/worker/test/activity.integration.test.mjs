import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout } from 'node:timers/promises';

import { startInfrastructure } from '@flowboard/config-jest/infrastructure';
import {
  createDatabase,
  createEventConsumerRepository,
  createOutboxRepository,
  initializeDatabase,
} from '@flowboard/database';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';

import { createActivityProcessor } from '../dist/activity.processor.js';
import { createActivityWorker } from '../dist/activity.worker.js';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const context = { actorUserId: id(101), workspaceId: id(1) };
async function eventually(action, predicate) {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    const value = await action();
    if (predicate(value)) return value;

    await setTimeout(30);
  }
  throw new Error('Activity condition did not become true');
}

test('a real BullMQ worker publishes a committed status change and stores one activity across duplicate jobs', async (t) => {
  const infra = await startInfrastructure();
  const cleanup = [async () => infra.close()];
  t.after(async () => {
    for (const close of cleanup.reverse()) await close();
  });
  await initializeDatabase({ databaseUrl: infra.databaseUrl, demoSeed: true });
  const database = createDatabase(infra.databaseUrl);
  cleanup.push(() => database.close());
  const outbox = createOutboxRepository(infra.databaseUrl);
  cleanup.push(() => outbox.close());
  const redis = new Redis(infra.redisUrl, { maxRetriesPerRequest: 0 });
  const subscriber = new Redis(infra.redisUrl, { maxRetriesPerRequest: 0 });
  cleanup.push(async () => {
    redis.disconnect();
    subscriber.disconnect();
  });
  const messages = [];
  subscriber.on('message', (_channel, value) => messages.push(JSON.parse(value)));
  await subscriber.subscribe('flowboard:events');
  const queue = new Queue('flowboard-events', { connection: redis });
  cleanup.push(() => queue.close());
  const runtime = createActivityWorker(infra.databaseUrl, infra.redisUrl);
  cleanup.push(() => runtime.close());
  await runtime.ready();
  await database.write(context, (store) =>
    store.tasks.update(id(700), {
      statusId: id(401),
      expectedVersion: 1,
      expectedConfigVersion: 1,
    }),
  );
  const events = await outbox.claim({ leaseMs: 30000, limit: 100 });
  const event = events.find((entry) => entry.aggregateId === id(700));
  assert.ok(event);
  const data = { schemaVersion: 1, eventId: event.id, workspaceId: event.workspaceId };
  await queue.add('event', data, { jobId: event.id, removeOnComplete: true });
  const page = await eventually(
    () => database.read(context, (store) => store.activities.list(id(700), { limit: 50 })),
    (value) => value.items.length === 1,
  );
  assert.equal(page.items[0].payload.afterStatusId, id(401));
  await eventually(
    async () => messages.length,
    (count) => count === 1,
  );
  assert.equal(messages[0].id, event.id);
  await eventually(
    () => queue.getJob(event.id),
    (job) => !job,
  );
  await queue.add('event', data, { jobId: event.id, removeOnComplete: true });
  await eventually(
    () => queue.getJob(event.id),
    (job) => !job,
  );
  assert.deepEqual(
    (await database.read(context, (store) => store.activities.list(id(700), { limit: 50 }))).items,
    page.items,
  );
  assert.equal(messages.length, 1);
  assert.equal(await runtime.healthy(), true);
});

async function processingFixture(t) {
  const infra = await startInfrastructure();
  const database = createDatabase(infra.databaseUrl);
  const consumer = createEventConsumerRepository(infra.databaseUrl);
  const outbox = createOutboxRepository(infra.databaseUrl);
  t.after(async () => {
    await consumer.close();
    await outbox.close();
    await database.close();
    infra.close();
  });
  await initializeDatabase({ databaseUrl: infra.databaseUrl, demoSeed: true });

  return { infra, database, consumer, outbox };
}

test('publication failure after insertion survives a consumer restart without inserting another activity', async (t) => {
  const { infra, database, consumer, outbox } = await processingFixture(t);
  await database.write(context, (store) =>
    store.tasks.update(id(700), {
      statusId: id(401),
      expectedVersion: 1,
      expectedConfigVersion: 1,
    }),
  );
  const event = (await outbox.claim({ leaseMs: 30000, limit: 100 })).find(
    (entry) => entry.aggregateId === id(700),
  );
  const job = {
    id: event.id,
    name: 'event',
    data: { schemaVersion: 1, eventId: event.id, workspaceId: event.workspaceId },
  };
  let attempts = 0;
  const processor = createActivityProcessor(consumer, async () => {
    attempts++;
    if (attempts === 1) throw new Error('Interrupted before publication');
  });
  await assert.rejects(processor(job), /Event delivery failed/);
  const first = (
    await database.read(context, (store) => store.activities.list(id(700), { limit: 50 }))
  ).items;
  assert.equal(first.length, 1);
  await consumer.close();
  const restartedConsumer = createEventConsumerRepository(infra.databaseUrl);
  t.after(() => restartedConsumer.close());
  const restartedProcessor = createActivityProcessor(restartedConsumer, async () => {
    attempts++;
  });
  await restartedProcessor(job);
  assert.deepEqual(
    (await database.read(context, (store) => store.activities.list(id(700), { limit: 50 }))).items,
    first,
  );
  await restartedProcessor(job);
  assert.equal(attempts, 2);
  for (const invalid of [
    { ...job, id: 'wrong' },
    { ...job, name: 'other' },
    { ...job, data: { ...job.data, password: 'forbidden' } },
  ])
    await assert.rejects(restartedProcessor(invalid), /Invalid event job/);
});

test('dependency readiness detects Redis and PostgreSQL outages and shutdown stays bounded', async (t) => {
  const { infra } = await processingFixture(t);
  const runtime = createActivityWorker(infra.databaseUrl, infra.redisUrl);
  t.after(() => runtime.close());
  await runtime.ready();
  await eventually(() => runtime.healthy(), Boolean);
  infra.pauseRedis();
  assert.equal(await runtime.healthy(), false);
  await eventually(() => runtime.healthy(), Boolean);
  infra.stopPostgres();
  assert.equal(await runtime.healthy(), false);
  const start = Date.now();
  await runtime.close();
  assert.ok(Date.now() - start < 4000);
});
