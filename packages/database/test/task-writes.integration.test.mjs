import { randomUUID } from 'node:crypto';

import { TaskCreatedEventSchema, TaskUpdatedEventSchema } from '@flowboard/contracts';
import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createDatabase } from '../dist/index.js';

import { insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let database;
let user;
beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  database = createDatabase(await applicationUrl(postgres));
  user = await insert(postgres.client, 'users', {
    id: randomUUID(),
    email: 'writes@example.test',
    name: 'Writer',
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
    name: 'Writes',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'admin',
  });
  let node;
  for (const type of ['space', 'folder', 'list'])
    node = await insert(postgres.client, 'nodes', {
      id: randomUUID(),
      workspace_id: workspace.id,
      type,
      name: type,
      parent_id: node?.id ?? null,
    });
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
  await insert(postgres.client, 'field_definitions', {
    id: randomUUID(),
    workspace_id: workspace.id,
    owner_id: workspace.id,
    owner_type: 'workspace',
    key: 'effort',
    name: 'Effort',
    type: 'number',
    required: true,
  });

  return {
    workspaceId: workspace.id,
    listId: node.id,
    statuses,
    context: { workspaceId: workspace.id, actorUserId: user.id },
  };
}
const create = (f, extra = {}) => ({
  title: 'Created',
  statusId: f.statuses[0],
  customFields: { effort: 0 },
  expectedConfigVersion: 1,
  ...extra,
});
const write = (f, action) => database.write(f.context, action);
async function snapshot(f) {
  const result = {};
  for (const table of ['tasks', 'task_assignees', 'outbox_events'])
    result[table] = (
      await postgres.client.query(
        `SELECT to_jsonb(t) AS value FROM ${table} t WHERE workspace_id=$1 ORDER BY to_jsonb(t)::text`,
        [f.workspaceId],
      )
    ).rows;
  result.workspace = (
    await postgres.client.query('SELECT to_jsonb(w) AS value FROM workspaces w WHERE id=$1', [
      f.workspaceId,
    ])
  ).rows[0].value;

  return result;
}

test.each(['create', 'update', 'archive'])(
  'outbox failure rolls back %s, assignments, audits and both revisions',
  async (operation) => {
    const f = await setup();
    const initial = await write(f, (store) =>
      store.tasks.create(f.listId, create(f, { assigneeIds: [user.id] })),
    );
    const before = await snapshot(f);
    await postgres.client.query(
      "CREATE FUNCTION reject_task_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.aggregate_type='task' THEN RAISE EXCEPTION 'fixture outbox failure'; END IF; RETURN NEW; END $$",
    );
    await postgres.client.query(
      'CREATE TRIGGER reject_task_event BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_task_event()',
    );
    try {
      const commands = {
        create: (store) => store.tasks.create(f.listId, create(f, { assigneeIds: [user.id] })),
        update: (store) =>
          store.tasks.update(initial.data.id, {
            title: 'Changed',
            assigneeIds: [],
            expectedVersion: 1,
            expectedConfigVersion: 1,
          }),
        archive: (store) =>
          store.tasks.archive(initial.data.id, { expectedConfigVersion: 1, expectedVersion: 1 }),
      };
      await expect(write(f, commands[operation])).rejects.toThrow();
      expect(await snapshot(f)).toEqual(before);
    } finally {
      await postgres.client.query('DROP TRIGGER reject_task_event ON outbox_events');
      await postgres.client.query('DROP FUNCTION reject_task_event()');
    }
  },
);

test('combined edits emit one sanitized transition, data-only revision and stable no-op', async () => {
  const f = await setup();
  const created = await write(f, (store) =>
    store.tasks.create(f.listId, create(f, { assigneeIds: [user.id] })),
  );
  const first = await snapshot(f);
  expect(first.workspace).toMatchObject({ config_version: 1, data_version: 2 });
  expect(TaskCreatedEventSchema.parse(first.outbox_events[0].value.payload)).toMatchObject({
    taskId: created.data.id,
    taskVersion: 1,
    statusId: f.statuses[0],
  });
  const input = {
    title: 'Changed',
    description: 'Private content never in events',
    statusId: f.statuses[1],
    priority: 'urgent',
    assigneeIds: [],
    customFields: { effort: 2 },
    expectedConfigVersion: 1,
    expectedVersion: 1,
  };
  const updated = await write(f, (store) => store.tasks.update(created.data.id, input));
  expect(updated).toMatchObject({
    configVersion: 1,
    dataVersion: 3,
    changedTaskIds: [created.data.id],
    data: { version: 2, assigneeIds: [] },
  });
  const second = await snapshot(f);
  expect(second.outbox_events).toHaveLength(2);
  const event = second.outbox_events.find((row) => row.value.aggregate_version === 2).value.payload;
  expect(TaskUpdatedEventSchema.parse(event).changes).toMatchObject({
    statusId: { before: f.statuses[0], after: f.statuses[1] },
    customFieldKeys: ['effort'],
    title: true,
    description: true,
  });
  expect(JSON.stringify(event)).not.toContain(input.description);
  const noop = await write(f, (store) =>
    store.tasks.update(created.data.id, { ...input, expectedVersion: 2 }),
  );
  expect(noop.changedTaskIds).toEqual([]);
  expect(await snapshot(f)).toEqual(second);
  await write(f, (store) =>
    store.tasks.archive(created.data.id, { expectedConfigVersion: 1, expectedVersion: 2 }),
  );
  const archived = await snapshot(f);
  expect(archived.workspace).toMatchObject({ config_version: 1, data_version: 4 });
  expect(archived.tasks[0].value.custom_fields).toEqual({ effort: 2 });
  expect(archived.tasks[0].value.archived_at).not.toBeNull();
  expect(archived.outbox_events).toHaveLength(3);
});

test('column appends ignore archived positions, preserve same-status positions and reject overflow', async () => {
  const f = await setup();
  const older = await write(f, (store) => store.tasks.create(f.listId, create(f)));
  await postgres.client.query('UPDATE tasks SET position=4 WHERE id=$1', [older.data.id]);
  await insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: f.workspaceId,
    primary_list_id: f.listId,
    status_id: f.statuses[0],
    title: 'Archived',
    position: 200,
    created_at: new Date('2025-01-01'),
    archived_at: new Date('2026-01-01'),
  });
  const next = await write(f, (store) => store.tasks.create(f.listId, create(f)));
  expect(next.data.position).toBe(5);
  const same = await write(f, (store) =>
    store.tasks.update(next.data.id, {
      title: 'Renamed',
      statusId: f.statuses[0],
      expectedVersion: 1,
      expectedConfigVersion: 1,
    }),
  );
  expect(same.data.position).toBe(5);
  await insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: f.workspaceId,
    primary_list_id: f.listId,
    status_id: f.statuses[1],
    title: 'Destination',
    position: 7,
    custom_fields: '{"effort":1}',
  });
  const moved = await write(f, (store) =>
    store.tasks.update(next.data.id, {
      statusId: f.statuses[1],
      expectedVersion: 2,
      expectedConfigVersion: 1,
    }),
  );
  expect(moved.data.position).toBe(8);
  await insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: f.workspaceId,
    primary_list_id: f.listId,
    status_id: f.statuses[2],
    title: 'Full',
    position: 2147483647,
    custom_fields: '{"effort":1}',
  });
  const before = await snapshot(f);
  await expect(
    write(f, (store) => store.tasks.create(f.listId, create(f, { statusId: f.statuses[2] }))),
  ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  expect(await snapshot(f)).toEqual(before);
});

test('archive retains assignments and can remove historically invalid field values', async () => {
  const f = await setup();
  const created = await write(f, (store) =>
    store.tasks.create(f.listId, create(f, { assigneeIds: [user.id] })),
  );
  await postgres.client.query('UPDATE tasks SET custom_fields=$1::jsonb WHERE id=$2', [
    JSON.stringify({ effort: 'legacy invalid' }),
    created.data.id,
  ]);
  const before = await snapshot(f);
  await write(f, (store) =>
    store.tasks.archive(created.data.id, { expectedConfigVersion: 1, expectedVersion: 1 }),
  );
  const after = await snapshot(f);
  expect(after.task_assignees).toEqual(before.task_assignees);
  expect(after.tasks[0].value.custom_fields).toEqual({ effort: 'legacy invalid' });
});

test('adding an assignee preserves the retained assignment audit timestamps', async () => {
  const f = await setup();
  const created = await write(f, (store) =>
    store.tasks.create(f.listId, create(f, { assigneeIds: [user.id] })),
  );
  const before = (await snapshot(f)).task_assignees.find(
    (row) => row.value.user_id === user.id,
  ).value;
  const other = await insert(postgres.client, 'users', {
    id: randomUUID(),
    email: `${randomUUID()}@example.test`,
    name: 'Other',
    password_hash: 'test-only',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: f.workspaceId,
    user_id: other.id,
    role: 'member',
  });
  await write(f, (store) =>
    store.tasks.update(created.data.id, {
      assigneeIds: [other.id, user.id],
      expectedVersion: 1,
      expectedConfigVersion: 1,
    }),
  );
  const after = (await snapshot(f)).task_assignees.find(
    (row) => row.value.user_id === user.id,
  ).value;
  expect(after).toEqual(before);
});

test('database clock controls new task audits even when the application clock is ahead', async () => {
  const f = await setup();
  const OriginalDate = globalThis.Date;
  const databaseTime = (
    await postgres.client.query('SELECT clock_timestamp() AS now')
  ).rows[0].now.getTime();
  class AheadDate extends OriginalDate {
    constructor(...args) {
      super(...(args.length ? args : [databaseTime + 86400000]));
    }
    static now() {
      return databaseTime + 86400000;
    }
  }
  let created;
  try {
    globalThis.Date = AheadDate;
    created = await write(f, (store) => store.tasks.create(f.listId, create(f)));
  } finally {
    globalThis.Date = OriginalDate;
  }
  const current = (
    await postgres.client.query('SELECT clock_timestamp() AS now')
  ).rows[0].now.getTime();
  expect(new Date(created.data.createdAt).getTime()).toBeLessThanOrEqual(current);
  expect(new Date(created.data.updatedAt).getTime()).toBeLessThanOrEqual(current);
  await expect(
    write(f, (store) =>
      store.tasks.archive(created.data.id, { expectedConfigVersion: 1, expectedVersion: 1 }),
    ),
  ).resolves.toBeUndefined();
});
