import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createDatabase } from '../dist/index.js';

import { fixtures, insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let database;
let data;
beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  data = await fixtures(postgres.client);
  database = createDatabase(await applicationUrl(postgres));
});
afterAll(async () => {
  await database?.close();
  await postgres?.client.end();
  postgres?.stop();
});

test('archive changes nodes and tasks atomically while preserving history and other tenants', async () => {
  const context = { workspaceId: data.a.workspace.id, actorUserId: data.user.id };
  await database.write(context, (store) =>
    store.hierarchy.archive(data.a.folder.id, { expectedConfigVersion: 1, expectedVersion: 1 }),
  );
  const { rows: nodes } = await postgres.client.query(
    'SELECT id,archived_at,version FROM nodes WHERE workspace_id=$1 ORDER BY type',
    [context.workspaceId],
  );
  expect(nodes.find((node) => node.id === data.a.space.id)).toMatchObject({
    archived_at: null,
    version: 1,
  });
  for (const id of [data.a.folder.id, data.a.list.id])
    expect(nodes.find((node) => node.id === id)).toMatchObject({
      archived_at: expect.any(Date),
      version: 2,
    });
  const task = (
    await postgres.client.query('SELECT archived_at,version FROM tasks WHERE id=$1', [
      data.a.task.id,
    ])
  ).rows[0];
  expect(task).toEqual({ archived_at: expect.any(Date), version: 2 });
  const foreign = (
    await postgres.client.query('SELECT archived_at,version FROM tasks WHERE id=$1', [
      data.b.task.id,
    ])
  ).rows[0];
  expect(foreign).toEqual({ archived_at: null, version: 1 });
  expect(
    (
      await postgres.client.query(
        'SELECT config_version,data_version FROM workspaces WHERE id=$1',
        [context.workspaceId],
      )
    ).rows[0],
  ).toEqual({ config_version: 2, data_version: 2 });
  for (const table of [
    'activities',
    'grants',
    'task_assignees',
    'status_overrides',
    'field_definitions',
  ])
    expect(
      (
        await postgres.client.query(
          `SELECT count(*)::int AS count FROM ${table} WHERE workspace_id=$1`,
          [context.workspaceId],
        )
      ).rows[0].count,
    ).toBe(1);
  const events = (
    await postgres.client.query(
      'SELECT aggregate_type,payload FROM outbox_events WHERE workspace_id=$1 AND aggregate_version=2',
      [context.workspaceId],
    )
  ).rows;
  expect(events).toHaveLength(4);
  expect(events.find((event) => event.aggregate_type === 'task').payload.changes).toEqual({
    archivedAt: { before: null, after: task.archived_at.toISOString() },
  });
  expect(events.filter((event) => event.aggregate_type === 'node')).toHaveLength(2);
  expect(await database.read(context, (store) => store.nodes.find(data.a.list.id))).toBeNull();
  await expect(
    database.write(context, (store) =>
      store.hierarchy.archive(data.a.folder.id, { expectedConfigVersion: 2, expectedVersion: 2 }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

async function workspace() {
  const record = await insert(postgres.client, 'workspaces', {
    id: randomUUID(),
    name: 'Isolated hierarchy',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: record.id,
    user_id: data.user.id,
    role: 'admin',
  });

  return { workspaceId: record.id, actorUserId: data.user.id };
}

test('outbox failure rolls back the entire subtree and collection revisions', async () => {
  const context = { workspaceId: data.b.workspace.id, actorUserId: data.otherUser.id };
  // The shared fixture already has a version-2 task event; align its current version.
  await postgres.client.query('UPDATE tasks SET version=2 WHERE id=$1', [data.b.task.id]);
  const snapshot = async () => {
    const tables = ['nodes', 'tasks', 'workspaces', 'outbox_events'];
    const values = [];
    for (const table of tables)
      values.push(
        (
          await postgres.client.query(
            `SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${table === 'workspaces' ? 'id' : 'workspace_id'}=$1 ORDER BY id`,
            [context.workspaceId],
          )
        ).rows,
      );

    return values;
  };
  const before = await snapshot();
  await postgres.client.query(
    "CREATE FUNCTION reject_hierarchy_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type = 'workspace.config.updated' THEN RAISE EXCEPTION 'test outbox failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_hierarchy_event BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_hierarchy_event()",
  );
  try {
    await expect(
      database.write(context, (store) =>
        store.hierarchy.archive(data.b.space.id, { expectedConfigVersion: 1, expectedVersion: 1 }),
      ),
    ).rejects.toThrow('test outbox failure');
  } finally {
    await postgres.client.query(
      'DROP TRIGGER reject_hierarchy_event ON outbox_events; DROP FUNCTION reject_hierarchy_event()',
    );
  }
  expect(await snapshot()).toEqual(before);
});

test('live descendants under an archived ancestor are hidden and cannot receive children or edits', async () => {
  const context = { workspaceId: data.b.workspace.id, actorUserId: data.otherUser.id };
  await postgres.client.query('UPDATE nodes SET archived_at=clock_timestamp() WHERE id=$1', [
    data.b.space.id,
  ]);
  expect(await database.read(context, (store) => store.hierarchy.find(data.b.list.id))).toBeNull();
  expect(await database.read(context, (store) => store.nodes.find(data.b.folder.id))).toBeNull();
  await expect(
    database.write(context, (store) =>
      store.hierarchy.create({
        name: 'Hidden child',
        type: 'list',
        parentId: data.b.folder.id,
        visibility: 'public',
        expectedConfigVersion: 1,
      }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    database.write(context, (store) =>
      store.hierarchy.update(data.b.folder.id, {
        expectedConfigVersion: 1,
        expectedVersion: 1,
        name: 'Hidden edit',
      }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('concurrent appends serialize and reject stale configuration without duplicate positions', async () => {
  const context = await workspace();
  const input = {
    expectedConfigVersion: 1,
    name: 'Sibling',
    parentId: null,
    type: 'space',
    visibility: 'public',
  };
  const results = await Promise.allSettled([
    database.write(context, (store) => store.hierarchy.create(input)),
    database.write(context, (store) => store.hierarchy.create(input)),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected').reason).toMatchObject({
    code: 'CONFIG_CONFLICT',
  });
  const second = await database.write(context, (store) =>
    store.hierarchy.create({ ...input, expectedConfigVersion: 2 }),
  );
  expect(second.node.position).toBe(1);
  const positions = (
    await postgres.client.query(
      'SELECT position FROM nodes WHERE workspace_id=$1 ORDER BY position',
      [context.workspaceId],
    )
  ).rows;
  expect(positions).toEqual([{ position: 0 }, { position: 1 }]);
});

test('archived descendants and tasks remain unchanged and position overflow rolls back creation', async () => {
  const context = await workspace();
  const root = await database.write(context, (store) =>
    store.hierarchy.create({
      expectedConfigVersion: 1,
      name: 'Root',
      parentId: null,
      type: 'space',
      visibility: 'public',
    }),
  );
  const folder = await database.write(context, (store) =>
    store.hierarchy.create({
      name: 'Folder',
      type: 'folder',
      parentId: root.node.id,
      visibility: 'public',
      expectedConfigVersion: 2,
    }),
  );
  const list = await database.write(context, (store) =>
    store.hierarchy.create({
      name: 'List',
      type: 'list',
      parentId: folder.node.id,
      visibility: 'public',
      expectedConfigVersion: 3,
    }),
  );
  const status = await insert(postgres.client, 'status_identities', {
    id: randomUUID(),
    workspace_id: context.workspaceId,
    key: 'todo',
    category: 'not_started',
  });
  const task = await insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: context.workspaceId,
    title: 'Retained task',
    primary_list_id: list.node.id,
    status_id: status.id,
  });
  await database.write(context, (store) =>
    store.hierarchy.archive(folder.node.id, { expectedConfigVersion: 4, expectedVersion: 1 }),
  );
  const snapshots = async () => [
    (
      await postgres.client.query(
        'SELECT to_jsonb(n) AS row FROM nodes n WHERE id=ANY($1::uuid[]) ORDER BY id',
        [[folder.node.id, list.node.id]],
      )
    ).rows,
    (await postgres.client.query('SELECT to_jsonb(t) AS row FROM tasks t WHERE id=$1', [task.id]))
      .rows,
  ];
  const old = await snapshots();
  await database.write(context, (store) =>
    store.hierarchy.archive(root.node.id, { expectedConfigVersion: 5, expectedVersion: 1 }),
  );
  expect(await snapshots()).toEqual(old);
  const other = await workspace();
  await insert(postgres.client, 'nodes', {
    id: randomUUID(),
    workspace_id: other.workspaceId,
    name: 'Maximum',
    type: 'space',
    position: 2147483647,
  });
  await expect(
    database.write(other, (store) =>
      store.hierarchy.create({
        expectedConfigVersion: 1,
        name: 'Overflow',
        parentId: null,
        type: 'space',
        visibility: 'public',
      }),
    ),
  ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  expect(
    (
      await postgres.client.query(
        'SELECT config_version,data_version FROM workspaces WHERE id=$1',
        [other.workspaceId],
      )
    ).rows[0],
  ).toEqual({ config_version: 1, data_version: 1 });
});

test('a create waiting behind archive cannot leave an active child below an archived parent', async () => {
  const context = await workspace();
  const root = await database.write(context, (store) =>
    store.hierarchy.create({
      expectedConfigVersion: 1,
      name: 'Root',
      parentId: null,
      type: 'space',
      visibility: 'public',
    }),
  );
  await postgres.client.query('BEGIN');
  let pendingArchive;
  let pendingCreate;
  try {
    await postgres.client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [
      context.workspaceId,
    ]);
    pendingArchive = database.write(context, (store) =>
      store.hierarchy.archive(root.node.id, { expectedConfigVersion: 2, expectedVersion: 1 }),
    );
    // Enqueue archive first; PostgreSQL lock inspection avoids a timing-based race.
    let blocked = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (
        (
          await postgres.client.query(
            'SELECT count(*)::int AS count FROM pg_locks WHERE granted=false AND pid<>pg_backend_pid()',
          )
        ).rows[0].count > 0
      ) {
        blocked = true;
        break;
      }

      await setTimeout(10);
    }
    expect(blocked).toBe(true);
    pendingCreate = database.write(context, (store) =>
      store.hierarchy.create({
        name: 'Late folder',
        type: 'folder',
        parentId: root.node.id,
        visibility: 'public',
        expectedConfigVersion: 2,
      }),
    );
    const resultsPromise = Promise.allSettled([pendingArchive, pendingCreate]);
    await postgres.client.query('COMMIT');
    const results = await resultsPromise;
    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect(['CONFIG_CONFLICT', 'NOT_FOUND']).toContain(results[1].reason.code);
    expect(
      (
        await postgres.client.query(
          'SELECT count(*)::int AS count FROM nodes WHERE workspace_id=$1 AND archived_at IS NULL',
          [context.workspaceId],
        )
      ).rows[0].count,
    ).toBe(0);
  } finally {
    await postgres.client.query('ROLLBACK');
    await Promise.allSettled([pendingArchive, pendingCreate].filter(Boolean));
  }
});
