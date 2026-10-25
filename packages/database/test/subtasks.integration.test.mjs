import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createDatabase, seedDemoData } from '../dist/index.js';

import { insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const context = { actorUserId: id(101), workspaceId: id(1) };
let postgres, database;
beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  await seedDemoData(postgres.connectionString);
  database = createDatabase(await applicationUrl(postgres));
});
afterAll(async () => {
  await database?.close();
  await postgres?.client.end();
  postgres?.stop();
});
const write = (action) => database.write(context, action);
const create = (extra = {}, listId = id(221)) =>
  write((store) =>
    store.tasks.create(listId, {
      title: 'Subtask fixture',
      statusId: id(400),
      customFields: { effort: 0 },
      expectedConfigVersion: 1,
      ...extra,
    }),
  );
const update = (task, extra) =>
  write((store) =>
    store.tasks.update(task.id, {
      expectedConfigVersion: 1,
      expectedVersion: task.version,
      ...extra,
    }),
  );

test('created children retain their parent on unrelated edits and detach only explicitly', async () => {
  const parent = (await create()).data;
  expect(parent.parentTaskId).toBeNull();
  const child = (await create({ parentTaskId: parent.id })).data;
  expect(child.parentTaskId).toBe(parent.id);
  const edited = (await update(child, { title: 'Independent child title' })).data;
  expect(edited.parentTaskId).toBe(parent.id);
  const detached = (await update(edited, { parentTaskId: null })).data;
  expect(detached.parentTaskId).toBeNull();
  expect(await database.read(context, (view) => view.tasks.find(parent.id))).toEqual(parent);
});

test('relations reject self-links, depth two, parents with children and invalid parent scope', async () => {
  const parent = (await create()).data;
  const child = (await create({ parentTaskId: parent.id })).data;
  const other = (await create()).data;
  await expect(update(parent, { parentTaskId: parent.id })).rejects.toMatchObject({
    code: 'INVALID_PARENT',
  });
  await expect(create({ parentTaskId: child.id })).rejects.toMatchObject({
    code: 'INVALID_PARENT',
  });
  await expect(update(parent, { parentTaskId: other.id })).rejects.toMatchObject({
    code: 'INVALID_PARENT',
  });
  await expect(create({ parentTaskId: id(708) })).rejects.toMatchObject({ code: 'INVALID_PARENT' });
  await expect(create({ parentTaskId: id(900) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await write((store) =>
    store.tasks.archive(other.id, { expectedVersion: other.version, expectedConfigVersion: 1 }),
  );
  await expect(create({ parentTaskId: other.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('linked tasks keep independent statuses but cannot orphan children by move or archive', async () => {
  const parent = (await create()).data;
  const child = (await create({ parentTaskId: parent.id })).data;
  const archive = (task) =>
    write((store) =>
      store.tasks.archive(task.id, {
        expectedVersion: task.version,
        expectedConfigVersion: 1,
      }),
    );
  const move = (task) =>
    write((store) =>
      store.tasks.move(task.id, {
        expectedVersion: task.version,
        expectedConfigVersion: 1,
        destinationListId: id(222),
        placement: { edge: 'end' },
      }),
    );
  await expect(archive(parent)).rejects.toMatchObject({ code: 'TASK_RELATION_IN_USE' });
  await expect(move(parent)).rejects.toMatchObject({ code: 'TASK_RELATION_IN_USE' });
  await expect(move(child)).rejects.toMatchObject({ code: 'TASK_RELATION_IN_USE' });
  const changed = (await update(child, { statusId: id(401) })).data;
  const ordered = (
    await write((store) =>
      store.tasks.reorder(changed.id, {
        expectedVersion: changed.version,
        expectedConfigVersion: 1,
        placement: { edge: 'start' },
      }),
    )
  ).data;
  expect(ordered.parentTaskId).toBe(parent.id);
  expect(ordered.statusId).toBe(id(401));
  await archive(ordered);
  await expect(move(parent)).rejects.toMatchObject({ code: 'TASK_RELATION_IN_USE' });
  const other = (await create()).data;
  await expect(update(parent, { parentTaskId: other.id })).rejects.toMatchObject({
    code: 'INVALID_PARENT',
  });
  await archive(parent);
  await expect(database.read(context, (view) => view.tasks.find(parent.id))).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
});

test('child filters apply before cursor limits and cannot refer to another list or tenant', async () => {
  const parent = (await create()).data;
  const children = [];
  for (let index = 0; index < 3; index++)
    children.push((await create({ parentTaskId: parent.id })).data);
  const query = { parentTaskId: parent.id, limit: 2, sort: 'manual', direction: 'asc' };
  const page = await database.read(context, (view) => view.tasks.list(id(221), query));
  expect(page.map((task) => task.id)).toEqual(children.map((task) => task.id));
  const cursor = {
    sort: 'manual',
    id: page[1].id,
    position: page[1].position,
    statusId: page[1].statusId,
  };
  const next = await database.read(context, (view) => view.tasks.list(id(221), query, cursor));
  expect(next.map((task) => task.id)).toEqual([children[2].id]);
  await expect(
    database.read(context, (view) => view.tasks.list(id(221), { ...query, parentTaskId: id(708) })),
  ).rejects.toMatchObject({ code: 'INVALID_PARENT' });
  await expect(
    database.read(context, (view) => view.tasks.list(id(221), { ...query, parentTaskId: id(900) })),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

async function snapshot() {
  const result = {};
  // Table and column identifiers are fixed test literals, never request data.
  for (const table of ['tasks', 'task_assignees', 'outbox_events', 'workspaces']) {
    result[table] = (
      await postgres.client.query(
        `SELECT to_jsonb(t) AS row FROM ${table} t WHERE ${table === 'workspaces' ? 'id' : 'workspace_id'}=$1 ORDER BY to_jsonb(t)::text`,
        [context.workspaceId],
      )
    ).rows;
  }

  return result;
}

test('unchanged links emit nothing and failed detach rolls back data, audits, revisions and events', async () => {
  const parent = (await create()).data;
  const child = (await create()).data;
  const initial = await snapshot();
  expect((await update(child, { parentTaskId: null })).changedTaskIds).toEqual([]);
  expect(await snapshot()).toEqual(initial);
  const attached = (await update(child, { parentTaskId: parent.id })).data;
  const event = (
    await postgres.client.query(
      'SELECT payload FROM outbox_events WHERE aggregate_id=$1 AND aggregate_version=$2',
      [child.id, attached.version],
    )
  ).rows[0].payload;
  expect(event.changes.parentTaskId).toEqual({ before: null, after: parent.id });
  const before = await snapshot();
  expect((await update(attached, { parentTaskId: parent.id })).changedTaskIds).toEqual([]);
  expect(await snapshot()).toEqual(before);
  // The UUID comes only from this isolated test's generated task.
  await postgres.client.query(
    `CREATE FUNCTION reject_subtask_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.aggregate_id='${child.id}'::uuid THEN RAISE EXCEPTION 'fixture outbox failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_subtask_event BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_subtask_event()`,
  );
  try {
    await expect(update(attached, { parentTaskId: null })).rejects.toBeDefined();
    expect(await snapshot()).toEqual(before);
  } finally {
    await postgres.client.query(
      'DROP TRIGGER reject_subtask_event ON outbox_events; DROP FUNCTION reject_subtask_event()',
    );
  }
});

test.each(['move', 'archive'])(
  'parent %s racing child creation leaves only one successful command',
  async (operation) => {
    const parent = (await create()).data;
    const results = await Promise.allSettled([
      write((store) =>
        operation === 'move'
          ? store.tasks.move(parent.id, {
              expectedVersion: parent.version,
              expectedConfigVersion: 1,
              destinationListId: id(222),
              placement: { edge: 'end' },
            })
          : store.tasks.archive(parent.id, {
              expectedVersion: parent.version,
              expectedConfigVersion: 1,
            }),
      ),
      create({ parentTaskId: parent.id }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(['INVALID_PARENT', 'TASK_RELATION_IN_USE', 'NOT_FOUND']).toContain(
      results.find((result) => result.status === 'rejected').reason.code,
    );
    const invalid = await postgres.client.query(
      'SELECT c.id FROM tasks c JOIN tasks p ON c.parent_task_id=p.id WHERE c.workspace_id=$1 AND c.archived_at IS NULL AND (p.archived_at IS NOT NULL OR c.primary_list_id<>p.primary_list_id)',
      [context.workspaceId],
    );
    expect(invalid.rows).toEqual([]);
  },
);

test('competing attachments cannot form a cycle or a second level', async () => {
  const first = (await create()).data;
  const second = (await create()).data;
  const results = await Promise.allSettled([
    update(first, { parentTaskId: second.id }),
    update(second, { parentTaskId: first.id }),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected').reason.code).toBe('INVALID_PARENT');
});

test('container archival still archives related parents and children together', async () => {
  const list = await insert(postgres.client, 'nodes', {
    id: randomUUID(),
    workspace_id: context.workspaceId,
    parent_id: id(211),
    type: 'list',
    name: 'Archived family',
  });
  const parent = (await create({}, list.id)).data;
  const child = (await create({ parentTaskId: parent.id }, list.id)).data;
  await write((store) =>
    store.hierarchy.archive(list.id, { expectedConfigVersion: 1, expectedVersion: 1 }),
  );
  const rows = (
    await postgres.client.query(
      'SELECT id,archived_at,parent_task_id FROM tasks WHERE id=ANY($1)',
      [[parent.id, child.id]],
    )
  ).rows;
  expect(rows.every((row) => row.archived_at instanceof Date)).toBe(true);
  expect(rows.find((row) => row.id === child.id).parent_task_id).toBe(parent.id);
});
