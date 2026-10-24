import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from '@jest/globals';

import * as databaseModule from '../dist/index.js';

import { fixtures, insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let data;
let url;
let repository;
beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  data = await fixtures(postgres.client);
  url = await applicationUrl(postgres);
});
beforeEach(async () => {
  await postgres.client.query('DELETE FROM activities');
  await postgres.client.query('DELETE FROM outbox_events');
  repository = databaseModule.createOutboxRepository(url);
});
afterEach(async () => repository?.close());
afterAll(async () => {
  await postgres?.client.end();
  postgres?.stop();
});

async function event(version = 2, workspace = data.a, actorId = data.user.id) {
  const id = randomUUID();

  return insert(postgres.client, 'outbox_events', {
    id,
    workspace_id: workspace.workspace.id,
    actor_id: actorId,
    aggregate_type: 'task',
    aggregate_id: workspace.task.id,
    aggregate_version: version,
    event_type: 'task.updated',
    payload: JSON.stringify({
      eventId: id,
      workspaceId: workspace.workspace.id,
      actorId,
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      taskId: workspace.task.id,
      taskVersion: version,
      currentListId: workspace.list.id,
      previousListId: workspace.list.id,
      changes: { title: true },
    }),
  });
}
const claim = () => repository.claim({ leaseMs: 10000, limit: 2 });

// Every case owns only the fresh container created above.
test('concurrent claimers take disjoint committed events across tenants', async () => {
  await event(2);
  await event(3);
  await event(2, data.b, data.otherUser.id);
  await event(3, data.b, data.otherUser.id);
  const other = databaseModule.createOutboxRepository(url);
  try {
    const batches = await Promise.all([claim(), other.claim({ leaseMs: 10000, limit: 2 })]);
    expect(batches.map((batch) => batch.length)).toEqual([2, 2]);
    expect(new Set(batches.flat().map((row) => row.id)).size).toBe(4);
    expect(new Set(batches.flat().map((row) => row.leaseToken)).size).toBe(4);
    expect(batches.flat().every((row) => row.attempts === 1)).toBe(true);
  } finally {
    await other.close();
  }
});

test('reclaiming an expired lease fences every stale acknowledgment', async () => {
  const original = await event();
  const [first] = await claim();
  await postgres.client.query(
    "UPDATE outbox_events SET lease_until=clock_timestamp()-INTERVAL '1 second' WHERE id=$1",
    [original.id],
  );
  expect(await repository.markQueued(first, 1000)).toBe(false);
  expect(await repository.retry(first, { code: 'QUEUE_UNAVAILABLE', delayMs: 1000 })).toBe(false);
  expect(await repository.quarantine(first, 'INVALID_EVENT')).toBe(false);
  const [second] = await claim();
  expect(second.leaseToken).not.toBe(first.leaseToken);
  expect(await repository.markQueued(first, 1000)).toBe(false);
  expect(await repository.retry(first, { code: 'QUEUE_UNAVAILABLE', delayMs: 1000 })).toBe(false);
  expect(await repository.quarantine(first, 'INVALID_EVENT')).toBe(false);
  expect(await repository.markQueued({ ...second, workspaceId: data.b.workspace.id }, 1000)).toBe(
    false,
  );
  expect(await repository.markQueued(second, 1000)).toBe(true);
  const {
    rows: [saved],
  } = await postgres.client.query('SELECT * FROM outbox_events WHERE id=$1', [original.id]);
  expect(saved).toMatchObject({
    attempts: 2,
    completed_at: null,
    lease_owner: null,
    lease_until: null,
    state: 'queued',
  });
  expect(saved.created_at).toEqual(original.created_at);
  expect(saved.updated_at.getTime()).toBeGreaterThanOrEqual(saved.created_at.getTime());
});

test('queued but undelivered events become claimable again after the recheck deadline', async () => {
  const row = await event();
  const [first] = await claim();
  await repository.markQueued(first, 60000);
  expect(await claim()).toEqual([]);
  await postgres.client.query(
    "UPDATE outbox_events SET next_attempt_at=clock_timestamp()-INTERVAL '1 second' WHERE id=$1",
    [row.id],
  );
  expect((await claim())[0].id).toBe(row.id);
});

test('transient retries remain pending while malformed events are quarantined', async () => {
  const row = await event();
  const [first] = await claim();
  expect(await repository.retry(first, { code: 'QUEUE_UNAVAILABLE', delayMs: 60000 })).toBe(true);
  expect(await claim()).toEqual([]);
  await postgres.client.query(
    "UPDATE outbox_events SET next_attempt_at=clock_timestamp()-INTERVAL '1 second' WHERE id=$1",
    [row.id],
  );
  const [second] = await claim();
  expect(await repository.quarantine(second, 'INVALID_EVENT')).toBe(true);
  expect(await claim()).toEqual([]);
  const {
    rows: [saved],
  } = await postgres.client.query('SELECT * FROM outbox_events WHERE id=$1', [row.id]);
  expect(saved).toMatchObject({
    completed_at: null,
    last_error_code: 'INVALID_EVENT',
    lease_owner: null,
    state: 'failed',
  });
});

test('rolled-back events never become claimable', async () => {
  await postgres.client.query('BEGIN');
  try {
    await event();
    expect(await claim()).toEqual([]);
  } finally {
    await postgres.client.query('ROLLBACK');
  }
  expect(await claim()).toEqual([]);
});

test('historical actors do not need current workspace membership', async () => {
  const userId = randomUUID();
  await insert(postgres.client, 'users', {
    id: userId,
    email: `${userId}@example.test`,
    name: 'Former member',
    password_hash: 'fixture-only',
  });
  await insert(postgres.client, 'memberships', {
    user_id: userId,
    workspace_id: data.a.workspace.id,
    role: 'member',
  });
  const row = await event(2, data.a, userId);
  await postgres.client.query('DELETE FROM memberships WHERE user_id=$1', [userId]);
  expect((await claim())[0].id).toBe(row.id);
});

test.each([
  { leaseMs: 1000, limit: 0 },
  { leaseMs: 1000, limit: 101 },
  { leaseMs: 0, limit: 1 },
  { leaseMs: 1000, limit: 1.5 },
])('claim bounds fail before querying: %j', async (options) => {
  await expect(repository.claim(options)).rejects.toBeDefined();
});

test('a fast worker handoff fences producer acknowledgments and active worker leases', async () => {
  const row = await event();
  const [producer] = await claim();
  await postgres.client.query(
    "UPDATE outbox_events SET state='processing', lease_owner=$2, lease_until=clock_timestamp()+INTERVAL '10 seconds', next_attempt_at=clock_timestamp()+INTERVAL '1 day' WHERE id=$1",
    [row.id, randomUUID()],
  );
  expect(await repository.markQueued(producer, 1000)).toBe(false);
  expect(await repository.retry(producer, { code: 'QUEUE_UNAVAILABLE', delayMs: 1000 })).toBe(
    false,
  );
  expect(await claim()).toEqual([]);
  await postgres.client.query(
    "UPDATE outbox_events SET lease_until=clock_timestamp()-INTERVAL '1 second' WHERE id=$1",
    [row.id],
  );
  expect((await claim())[0].id).toBe(row.id);
});
