import { randomUUID } from 'node:crypto';

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
    email: 'node-move@example.test',
    name: 'Mover',
    password_hash: 'test-only',
  });
});
afterAll(async () => {
  await database?.close();
  await postgres?.client.end();
  postgres?.stop();
});
const addNode = (f, type, parentId, position = 0, extra = {}) =>
  insert(postgres.client, 'nodes', {
    id: randomUUID(),
    workspace_id: f.workspaceId,
    type,
    name: type,
    parent_id: parentId,
    position,
    ...extra,
  });
async function setup() {
  const workspace = await insert(postgres.client, 'workspaces', {
    id: randomUUID(),
    name: 'Move workspace',
  });
  const f = {
    workspaceId: workspace.id,
    context: { workspaceId: workspace.id, actorUserId: user.id },
    statuses: [],
  };
  await insert(postgres.client, 'memberships', {
    workspace_id: f.workspaceId,
    user_id: user.id,
    role: 'admin',
  });
  for (const [position, category] of ['not_started', 'active', 'done'].entries()) {
    const status = await insert(postgres.client, 'status_identities', {
      id: randomUUID(),
      workspace_id: f.workspaceId,
      key: `s_${position}`,
      category,
    });
    await insert(postgres.client, 'status_overrides', {
      id: randomUUID(),
      workspace_id: f.workspaceId,
      status_id: status.id,
      owner_type: 'workspace',
      owner_id: f.workspaceId,
      name: category,
      color: '#123456',
      position,
    });
    f.statuses.push(status.id);
  }
  f.source = await addNode(f, 'space', null, 0);
  f.destination = await addNode(f, 'space', null, 1);

  return f;
}
const write = (f, fn) => database.write(f.context, fn);
const input = (parentId, extra = {}) => ({
  parentId,
  placement: { edge: 'start' },
  expectedConfigVersion: 1,
  expectedVersion: 1,
  ...extra,
});
async function snapshot(f) {
  const result = {};
  for (const table of [
    'nodes',
    'tasks',
    'task_assignees',
    'grants',
    'field_definitions',
    'status_overrides',
    'status_identities',
    'outbox_events',
  ])
    result[table] = (
      await postgres.client.query(
        `SELECT to_jsonb(t) AS value FROM ${table} t WHERE workspace_id=$1 ORDER BY to_jsonb(t)::text`,
        [f.workspaceId],
      )
    ).rows.map((row) => row.value);
  result.workspace = (
    await postgres.client.query('SELECT to_jsonb(w) AS value FROM workspaces w WHERE id=$1', [
      f.workspaceId,
    ])
  ).rows[0].value;

  return result;
}

test('final outbox failure restores the entire moved subtree and all related state', async () => {
  const f = await setup(),
    folder = await addNode(f, 'folder', f.source.id, 1),
    sibling = await addNode(f, 'folder', f.source.id, 2);
  await addNode(f, 'folder', f.destination.id, 0);
  const list = await addNode(f, 'list', folder.id);
  const task = await insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: f.workspaceId,
    primary_list_id: list.id,
    status_id: f.statuses[0],
    title: 'Retained task',
  });
  await insert(postgres.client, 'task_assignees', {
    workspace_id: f.workspaceId,
    task_id: task.id,
    user_id: user.id,
  });
  await insert(postgres.client, 'grants', {
    workspace_id: f.workspaceId,
    resource_id: folder.id,
    user_id: user.id,
    mode: 'allow',
  });
  const before = await snapshot(f);
  await postgres.client.query(
    "CREATE FUNCTION reject_node_move() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='workspace.config.updated' THEN RAISE EXCEPTION 'fixture final outbox failure'; END IF; RETURN NEW; END $$",
  );
  await postgres.client.query(
    'CREATE TRIGGER reject_node_move BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_node_move()',
  );
  try {
    await expect(
      write(f, (store) => store.hierarchy.move(folder.id, input(f.destination.id))),
    ).rejects.toThrow();
    expect(await snapshot(f)).toEqual(before);
  } finally {
    await postgres.client.query('DROP TRIGGER reject_node_move ON outbox_events');
    await postgres.client.query('DROP FUNCTION reject_node_move()');
  }
  const moved = await write(f, (store) =>
    store.hierarchy.move(folder.id.toUpperCase(), input(f.destination.id)),
  );
  expect(moved.node).toMatchObject({ id: folder.id, parentId: f.destination.id, version: 2 });
  expect(moved).toMatchObject({ configVersion: 2, dataVersion: 2 });
  const after = await snapshot(f);
  expect(after.nodes.find((row) => row.id === list.id)).toEqual(
    before.nodes.find((row) => row.id === list.id),
  );
  expect(after.tasks).toEqual(before.tasks);
  expect(after.grants).toEqual(before.grants);
  expect(after.task_assignees).toEqual(before.task_assignees);
  expect(after.nodes.find((row) => row.id === sibling.id)).toMatchObject({
    position: 0,
    version: 2,
  });
  const nodeEvents = after.outbox_events.filter((row) => row.event_type === 'node.updated');
  expect(new Set(nodeEvents.map((row) => row.aggregate_id)).size).toBe(nodeEvents.length);
  expect(nodeEvents.find((row) => row.aggregate_id === folder.id).aggregate_version).toBe(2);
});

test('an empty moved folder cannot exceed the effective field cap', async () => {
  const f = await setup(),
    folder = await addNode(f, 'folder', f.source.id);
  for (let index = 0; index < 100; index++)
    await insert(postgres.client, 'field_definitions', {
      id: randomUUID(),
      workspace_id: f.workspaceId,
      owner_type: 'space',
      owner_id: f.destination.id,
      key: `f_${index}`,
      name: `Field ${index}`,
      type: 'text',
    });
  await insert(postgres.client, 'field_definitions', {
    id: randomUUID(),
    workspace_id: f.workspaceId,
    owner_type: 'folder',
    owner_id: folder.id,
    key: 'extra',
    name: 'Extra',
    type: 'text',
  });
  const before = await snapshot(f);
  await expect(
    write(f, (store) => store.hierarchy.move(folder.id, input(f.destination.id))),
  ).rejects.toMatchObject({ code: 'CONFIG_INVALIDATES_TASKS' });
  expect(await snapshot(f)).toEqual(before);
});

test('source and destination ordering includes all siblings and preserves canonical no-ops', async () => {
  const f = await setup(),
    folders = [];
  for (let index = 0; index < 103; index++)
    folders.push(await addNode(f, 'folder', f.source.id, index * 2));
  const target = folders[102];
  const result = await write(f, (store) =>
    store.hierarchy.move(target.id, input(f.destination.id)),
  );
  expect(result.node).toMatchObject({ parentId: f.destination.id, position: 0, version: 2 });
  const state = await snapshot(f);
  expect(
    state.nodes
      .filter((row) => row.type === 'folder' && row.parent_id === f.source.id)
      .sort((a, b) => a.position - b.position)
      .map((row) => row.position),
  ).toEqual(Array.from({ length: 102 }, (_, index) => index));
  const noop = await write(f, (store) =>
    store.hierarchy.move(
      target.id,
      input(f.destination.id, { expectedConfigVersion: 2, expectedVersion: 2 }),
    ),
  );
  expect(noop).toEqual(result);
  expect(await snapshot(f)).toEqual(state);
});
