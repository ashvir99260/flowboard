import { randomUUID } from 'node:crypto';

import { TaskUpdatedEventSchema } from '@flowboard/contracts';
import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createDatabase } from '../dist/index.js';

import { insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres, database, user;
beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  database = createDatabase(await applicationUrl(postgres));
  user = await insert(postgres.client, 'users', {
    id: randomUUID(),
    email: 'moves@example.test',
    name: 'Mover',
    password_hash: 'test-only',
  });
});
afterAll(async () => {
  await database?.close();
  await postgres?.client.end();
  postgres?.stop();
});
async function setup() {
  const workspace = await insert(postgres.client, 'workspaces', {
    id: randomUUID(),
    name: 'Moves',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'admin',
  });
  const space = await insert(postgres.client, 'nodes', {
    id: randomUUID(),
    workspace_id: workspace.id,
    type: 'space',
    name: 'Space',
  });
  const folder = await insert(postgres.client, 'nodes', {
    id: randomUUID(),
    workspace_id: workspace.id,
    type: 'folder',
    name: 'Folder',
    parent_id: space.id,
  });
  const lists = [];
  for (const name of ['Source', 'Destination'])
    lists.push(
      (
        await insert(postgres.client, 'nodes', {
          id: randomUUID(),
          workspace_id: workspace.id,
          type: 'list',
          name,
          parent_id: folder.id,
        })
      ).id,
    );
  const statuses = [];
  for (const [position, category] of ['not_started', 'active', 'done'].entries()) {
    const status = await insert(postgres.client, 'status_identities', {
      id: randomUUID(),
      workspace_id: workspace.id,
      key: `status_${position}`,
      category,
    });
    await insert(postgres.client, 'status_overrides', {
      id: randomUUID(),
      workspace_id: workspace.id,
      status_id: status.id,
      owner_type: 'workspace',
      owner_id: workspace.id,
      name: category,
      color: '#123456',
      position,
    });
    statuses.push(status.id);
  }

  return {
    workspaceId: workspace.id,
    lists,
    statuses,
    context: { workspaceId: workspace.id, actorUserId: user.id },
  };
}
const add = (f, list, position = 0, status = f.statuses[0]) =>
  insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: f.workspaceId,
    primary_list_id: list,
    status_id: status,
    title: 'Move fixture',
    position,
  });
const write = (f, action) => database.write(f.context, action);
const input = (f, extra = {}) => ({
  destinationListId: f.lists[1],
  placement: { edge: 'start' },
  expectedVersion: 1,
  expectedConfigVersion: 1,
  ...extra,
});
async function snapshot(f) {
  const data = {};
  for (const table of ['tasks', 'outbox_events', 'task_assignees'])
    data[table] = (
      await postgres.client.query(
        `SELECT to_jsonb(t) AS value FROM ${table} t WHERE workspace_id=$1 ORDER BY to_jsonb(t)::text`,
        [f.workspaceId],
      )
    ).rows.map((row) => row.value);
  data.workspace = (
    await postgres.client.query('SELECT to_jsonb(w) AS value FROM workspaces w WHERE id=$1', [
      f.workspaceId,
    ])
  ).rows[0].value;

  return data;
}

test('uppercase task IDs remain one canonical target during cross-list placement', async () => {
  const f = await setup(),
    target = await add(f, f.lists[0]);
  const result = await write(f, (store) => store.tasks.move(target.id.toUpperCase(), input(f)));
  expect(result.data).toMatchObject({
    id: target.id,
    primaryListId: f.lists[1],
    version: 2,
    position: 0,
  });
});

test('move updates each changed row once, emits precise transitions and increments data once', async () => {
  const f = await setup();
  const first = await add(f, f.lists[0], 0),
    target = await add(f, f.lists[0], 1),
    last = await add(f, f.lists[0], 2);
  const dest = await add(f, f.lists[1], 0);
  const result = await write(f, (store) => store.tasks.move(target.id, input(f)));
  const state = await snapshot(f);
  expect(result).toMatchObject({
    configVersion: 1,
    dataVersion: 2,
    data: { primaryListId: f.lists[1], version: 2, position: 0 },
  });
  expect(new Set(result.changedTaskIds)).toEqual(new Set([target.id, last.id, dest.id]));
  expect(state.tasks.find((row) => row.id === first.id).version).toBe(1);
  expect(state.tasks.filter((row) => row.id !== first.id).every((row) => row.version === 2)).toBe(
    true,
  );
  expect(state.outbox_events).toHaveLength(3);
  const event = TaskUpdatedEventSchema.parse(
    state.outbox_events.find((row) => row.aggregate_id === target.id).payload,
  );
  expect(event).toMatchObject({
    previousListId: f.lists[0],
    currentListId: f.lists[1],
    taskVersion: 2,
    changes: { primaryListId: { before: f.lists[0], after: f.lists[1] } },
  });
  const before = await snapshot(f);
  const noop = await write(f, (store) =>
    store.tasks.reorder(target.id, {
      placement: { edge: 'start' },
      expectedVersion: 2,
      expectedConfigVersion: 1,
    }),
  );
  expect(noop.changedTaskIds).toEqual([]);
  expect(await snapshot(f)).toEqual(before);
});

test('a list-only move emits an event even with identical status, position and fields', async () => {
  const f = await setup(),
    target = await add(f, f.lists[0]);
  const result = await write(f, (store) => store.tasks.move(target.id, input(f)));
  expect(result.changedTaskIds).toEqual([target.id]);
  const state = await snapshot(f);
  expect(state.outbox_events[0].payload.changes).toEqual({
    primaryListId: { before: f.lists[0], after: f.lists[1] },
  });
});

test.each(['move', 'reorder'])(
  'final event failure restores %s columns, task audits and workspace revisions',
  async (operation) => {
    const f = await setup(),
      target = await add(f, f.lists[0], 0);
    await add(f, f.lists[0], 1);
    await add(f, f.lists[1], 0);
    const before = await snapshot(f);
    await postgres.client.query(
      "CREATE FUNCTION reject_move_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture move failure'; END $$",
    );
    await postgres.client.query(
      'CREATE TRIGGER reject_move_event BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_move_event()',
    );
    try {
      const command =
        operation === 'move'
          ? (store) => store.tasks.move(target.id, input(f))
          : (store) =>
              store.tasks.reorder(target.id, {
                placement: { edge: 'end' },
                expectedVersion: 1,
                expectedConfigVersion: 1,
              });
      await expect(write(f, command)).rejects.toThrow();
      expect(await snapshot(f)).toEqual(before);
    } finally {
      await postgres.client.query('DROP TRIGGER reject_move_event ON outbox_events');
      await postgres.client.query('DROP FUNCTION reject_move_event()');
    }
  },
);

test('reorder handles complete columns beyond page limits and normalizes ties and gaps', async () => {
  const f = await setup(),
    rows = [];
  for (let index = 0; index < 103; index++)
    rows.push(await add(f, f.lists[0], index === 1 ? 0 : index * 3));
  const target = rows[102];
  const result = await write(f, (store) =>
    store.tasks.reorder(target.id, {
      placement: { edge: 'start' },
      expectedVersion: 1,
      expectedConfigVersion: 1,
    }),
  );
  const state = await snapshot(f);
  const ordered = state.tasks.sort((a, b) => a.position - b.position);
  expect(ordered[0].id).toBe(target.id);
  expect(ordered.map((row) => row.position)).toEqual(
    Array.from({ length: 103 }, (_, index) => index),
  );
  expect(new Set(result.changedTaskIds).size).toBe(result.changedTaskIds.length);
  expect(state.outbox_events).toHaveLength(result.changedTaskIds.length);
  expect(state.workspace).toMatchObject({ config_version: 1, data_version: 2 });
});
