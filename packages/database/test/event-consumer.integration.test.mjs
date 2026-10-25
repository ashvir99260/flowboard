import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import * as databaseModule from '../dist/index.js';

import { fixtures, insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let data;
let repository;
let url;
beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  data = await fixtures(postgres.client);
  url = await applicationUrl(postgres);
  repository = databaseModule.createEventConsumerRepository(url);
});
afterAll(async () => {
  await repository?.close();
  await postgres?.client.end();
  postgres?.stop();
});

async function statusEvent(version = 2) {
  const target = await insert(postgres.client, 'status_identities', {
    id: randomUUID(),
    workspace_id: data.a.workspace.id,
    key: `active_${version}`,
    category: 'active',
  });
  const eventId = randomUUID();
  const row = await insert(postgres.client, 'outbox_events', {
    id: eventId,
    workspace_id: data.a.workspace.id,
    actor_id: data.user.id,
    aggregate_type: 'task',
    aggregate_id: data.a.task.id,
    aggregate_version: version,
    event_type: 'task.updated',
    payload: JSON.stringify({
      schemaVersion: 1,
      eventId,
      workspaceId: data.a.workspace.id,
      actorId: data.user.id,
      taskId: data.a.task.id,
      taskVersion: version,
      occurredAt: '2026-10-24T10:00:00.000Z',
      previousListId: data.a.list.id,
      currentListId: data.a.list.id,
      changes: { statusId: { before: data.a.status.id, after: target.id } },
    }),
  });

  return {
    row,
    target,
    reference: { schemaVersion: 1, eventId, workspaceId: data.a.workspace.id },
  };
}

test('processing persists one verified status activity without changing it on retry, then completes delivery', async () => {
  const { row, target, reference } = await statusEvent();
  const claim = await repository.claim(reference, 10000);
  expect(claim.id).toBe(row.id);
  expect((await repository.persist(claim)).state).toBe('ready');
  const first = (
    await postgres.client.query('SELECT * FROM activities WHERE event_id=$1', [row.id])
  ).rows[0];
  expect(first).toMatchObject({
    actor_id: data.user.id,
    workspace_id: data.a.workspace.id,
    task_id: data.a.task.id,
    type: 'task.status_changed',
    payload: {
      beforeStatusId: data.a.status.id,
      afterStatusId: target.id,
      taskVersion: 2,
      occurredAt: '2026-10-24T10:00:00.000Z',
    },
  });
  expect((await repository.persist(claim)).state).toBe('ready');
  expect(
    (await postgres.client.query('SELECT * FROM activities WHERE event_id=$1', [row.id])).rows,
  ).toEqual([first]);
  expect(await repository.complete(claim)).toBe(true);
  expect(await repository.claim(reference, 10000)).toBeNull();
  expect(
    (
      await postgres.client.query('SELECT state,completed_at FROM outbox_events WHERE id=$1', [
        row.id,
      ])
    ).rows[0],
  ).toMatchObject({ state: 'delivered', completed_at: expect.any(Date) });
});

test('concurrent consumers and an expired lease cannot duplicate activity or acknowledge a newer owner', async () => {
  const { row, reference } = await statusEvent(3);
  const claims = await Promise.all([
    repository.claim(reference, 10000),
    repository.claim(reference, 10000),
  ]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  const old = claims.find(Boolean);
  expect((await repository.persist(old)).state).toBe('ready');
  const original = (
    await postgres.client.query('SELECT * FROM activities WHERE event_id=$1', [row.id])
  ).rows[0];
  await postgres.client.query(
    "UPDATE outbox_events SET lease_until=clock_timestamp()-INTERVAL '1 second' WHERE id=$1",
    [row.id],
  );
  const current = await repository.claim(reference, 10000);
  expect(current.leaseToken).not.toBe(old.leaseToken);
  expect((await repository.persist(old)).state).toBe('stale');
  expect(await repository.complete(old)).toBe(false);
  expect(await repository.retry(old, 0)).toBe(false);
  expect(await repository.quarantine(old)).toBe(false);
  expect((await repository.persist(current)).state).toBe('ready');
  expect(
    (await postgres.client.query('SELECT * FROM activities WHERE event_id=$1', [row.id])).rows,
  ).toEqual([original]);
  expect(await repository.complete(current)).toBe(true);
});

test('a foreign job reference cannot claim or mutate an event in another workspace', async () => {
  const { row, reference } = await statusEvent(4);
  expect(
    await repository.claim({ ...reference, workspaceId: data.b.workspace.id }, 10000),
  ).toBeNull();
  expect(
    (await postgres.client.query('SELECT state,attempts FROM outbox_events WHERE id=$1', [row.id]))
      .rows[0],
  ).toEqual({ attempts: 0, state: 'pending' });
});

test.each(['envelope', 'task', 'list', 'status', 'move', 'parent'])(
  'quarantines an invalid %s without creating activity',
  async (kind) => {
    const version = { envelope: 5, list: 7, move: 11, parent: 12, status: 8, task: 6 }[kind];
    const { row, reference } = await statusEvent(version);
    const payload = { ...row.payload };
    let aggregateId = data.a.task.id;
    if (kind === 'envelope') payload.workspaceId = data.b.workspace.id;

    if (kind === 'task') {
      payload.taskId = data.b.task.id;
      aggregateId = data.b.task.id;
    }

    if (kind === 'list') payload.previousListId = data.b.list.id;

    if (kind === 'status') payload.changes.statusId.after = data.b.status.id;

    if (kind === 'move')
      payload.changes.primaryListId = { before: data.a.list.id, after: data.b.list.id };

    if (kind === 'parent') payload.changes.parentTaskId = { before: null, after: data.b.task.id };

    await postgres.client.query('UPDATE outbox_events SET payload=$2,aggregate_id=$3 WHERE id=$1', [
      row.id,
      JSON.stringify(payload),
      aggregateId,
    ]);
    const claim = await repository.claim(reference, 10000);
    expect((await repository.persist(claim)).state).toBe('invalid');
    expect(await repository.quarantine(claim)).toBe(true);
    expect(
      (await postgres.client.query('SELECT * FROM activities WHERE event_id=$1', [row.id])).rows,
    ).toEqual([]);
    expect(await repository.claim(reference, 10000)).toBeNull();
  },
);

test('historical detached parents may move or archive before their event is consumed', async () => {
  const list = await insert(postgres.client, 'nodes', {
    id: randomUUID(),
    workspace_id: data.a.workspace.id,
    parent_id: data.a.folder.id,
    type: 'list',
    name: 'Historical parent list',
  });
  const parent = await insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: data.a.workspace.id,
    primary_list_id: list.id,
    status_id: data.a.status.id,
    title: 'Historical parent',
  });
  await postgres.client.query('UPDATE tasks SET archived_at=clock_timestamp() WHERE id=$1', [
    parent.id,
  ]);
  const { row, reference } = await statusEvent(13);
  await postgres.client.query('UPDATE outbox_events SET payload=$2 WHERE id=$1', [
    row.id,
    JSON.stringify({
      ...row.payload,
      changes: { parentTaskId: { before: parent.id, after: null } },
    }),
  ]);
  const claim = await repository.claim(reference, 10000);
  expect((await repository.persist(claim)).state).toBe('ready');
  expect(
    (await postgres.client.query('SELECT id FROM activities WHERE event_id=$1', [row.id])).rows,
  ).toEqual([]);
});

test('non-status changes can be published without inventing a status activity', async () => {
  const { row, reference } = await statusEvent(9);
  await postgres.client.query('UPDATE outbox_events SET payload=$2 WHERE id=$1', [
    row.id,
    JSON.stringify({ ...row.payload, changes: { title: true } }),
  ]);
  const claim = await repository.claim(reference, 10000);
  expect((await repository.persist(claim)).state).toBe('ready');
  expect(
    (await postgres.client.query('SELECT * FROM activities WHERE event_id=$1', [row.id])).rows,
  ).toEqual([]);
  expect(await repository.complete(claim)).toBe(true);
});

test('activity retains an original actor after workspace membership ends', async () => {
  const { row, reference } = await statusEvent(10);
  const former = await insert(postgres.client, 'users', {
    id: randomUUID(),
    name: 'Former member',
    email: 'former@example.test',
    password_hash: 'fixture-only',
  });
  await insert(postgres.client, 'memberships', {
    user_id: former.id,
    workspace_id: data.a.workspace.id,
    role: 'member',
  });
  await postgres.client.query('UPDATE outbox_events SET actor_id=$2,payload=$3 WHERE id=$1', [
    row.id,
    former.id,
    JSON.stringify({ ...row.payload, actorId: former.id }),
  ]);
  await postgres.client.query('DELETE FROM memberships WHERE user_id=$1', [former.id]);
  const claim = await repository.claim(reference, 10000);
  expect((await repository.persist(claim)).state).toBe('ready');
  expect(
    (await postgres.client.query('SELECT actor_id FROM activities WHERE event_id=$1', [row.id]))
      .rows[0].actor_id,
  ).toBe(former.id);
});

test('tenant activity reads use a descending tie breaker and a fixed upper watermark', async () => {
  const task = await insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: data.a.workspace.id,
    primary_list_id: data.a.list.id,
    status_id: data.a.status.id,
    title: 'Pagination fixture',
  });
  const status = await insert(postgres.client, 'status_identities', {
    id: randomUUID(),
    workspace_id: data.a.workspace.id,
    key: 'pagination_active',
    category: 'active',
  });
  const stamp = new Date('2020-01-01T00:00:00.000Z');
  const activityId = (n) => `82000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const add = async (n, createdAt = stamp) => {
    const eventId = randomUUID();
    const event = {
      schemaVersion: 1,
      eventId,
      workspaceId: data.a.workspace.id,
      actorId: data.user.id,
      taskId: task.id,
      taskVersion: n + 1,
      occurredAt: stamp.toISOString(),
      previousListId: data.a.list.id,
      currentListId: data.a.list.id,
      changes: { statusId: { before: data.a.status.id, after: status.id } },
    };
    await insert(postgres.client, 'outbox_events', {
      id: eventId,
      workspace_id: data.a.workspace.id,
      actor_id: data.user.id,
      aggregate_type: 'task',
      aggregate_id: task.id,
      aggregate_version: n + 1,
      event_type: 'task.updated',
      payload: JSON.stringify(event),
    });
    await insert(postgres.client, 'activities', {
      id: activityId(n),
      workspace_id: data.a.workspace.id,
      task_id: task.id,
      actor_id: data.user.id,
      event_id: eventId,
      type: 'task.status_changed',
      payload: JSON.stringify({
        beforeStatusId: data.a.status.id,
        afterStatusId: status.id,
        occurredAt: stamp.toISOString(),
        taskVersion: n + 1,
      }),
      created_at: createdAt,
      updated_at: createdAt,
    });
  };
  for (const n of [1, 2, 3, 4, 5]) await add(n);
  const database = databaseModule.createDatabase(url);
  const context = { actorUserId: data.user.id, workspaceId: data.a.workspace.id };
  try {
    const first = await database.read(context, (store) =>
      store.activities.list(task.id, { limit: 2 }),
    );
    expect(first.items.map((item) => item.id)).toEqual([5, 4, 3].map(activityId));
    await add(6, new Date(stamp.getTime() + 1000));
    const second = await database.read(context, (store) =>
      store.activities.list(task.id, {
        limit: 2,
        upper: first.upper,
        after: { createdAt: stamp, id: activityId(4) },
      }),
    );
    expect(second.items.map((item) => item.id)).toEqual([3, 2, 1].map(activityId));
    expect(second.items[0].actor).toEqual({ id: data.user.id, name: 'Alice' });
    await expect(
      database.read(context, (store) => store.activities.list(data.b.task.id, { limit: 2 })),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  } finally {
    await database.close();
  }
});
