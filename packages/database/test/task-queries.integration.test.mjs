import { randomUUID } from 'node:crypto';

import { ListTasksQuerySchema } from '@flowboard/contracts';
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
    email: 'queries@example.test',
    name: 'Reader',
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
    name: 'Query fixture',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'admin',
  });
  let parent = null;
  for (const type of ['space', 'folder', 'list'])
    parent = await insert(postgres.client, 'nodes', {
      id: randomUUID(),
      workspace_id: workspace.id,
      type,
      name: type,
      parent_id: parent?.id ?? null,
    });
  const statuses = [];
  for (const [index, category] of ['not_started', 'active', 'done'].entries()) {
    const identity = await insert(postgres.client, 'status_identities', {
      id: randomUUID(),
      workspace_id: workspace.id,
      key: `status_${index}`,
      category,
    });
    await insert(postgres.client, 'status_overrides', {
      id: randomUUID(),
      workspace_id: workspace.id,
      status_id: identity.id,
      owner_type: 'workspace',
      owner_id: workspace.id,
      name: category,
      color: '#123456',
      position: [2, 0, 1][index],
    });
    statuses.push(identity.id);
  }

  return {
    workspaceId: workspace.id,
    listId: parent.id,
    statuses,
    context: { workspaceId: workspace.id, actorUserId: user.id },
  };
}
async function task(f, values = {}) {
  return insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: f.workspaceId,
    primary_list_id: f.listId,
    status_id: f.statuses[0],
    title: 'Query fixture',
    ...values,
  });
}
const query = (input = {}) => ListTasksQuerySchema.parse({ limit: '1', ...input });
async function all(f, input = {}) {
  const items = [];
  let after;
  for (let count = 0; count < 20; count += 1) {
    const rows = await database.read(f.context, (store) =>
      store.tasks.list(f.listId, query(input), after),
    );
    if (!rows.length) return items;

    const last = rows[0];
    items.push(last);
    after =
      input.sort === 'dueDate'
        ? { sort: 'dueDate', id: last.id, dueDate: last.dueDate }
        : input.sort === 'priority'
          ? { sort: 'priority', id: last.id, priority: last.priority }
          : { sort: 'manual', id: last.id, statusId: last.statusId, position: last.position };
    if (rows.length === 1) return items;
  }
  throw new Error('Pagination did not terminate');
}

test('manual ordering follows resolved statuses and UUID ties across single-item pages', async () => {
  const f = await setup();
  const rows = [];
  for (const status of f.statuses)
    for (let index = 0; index < 2; index += 1)
      rows.push(await task(f, { status_id: status, position: 0 }));
  const expected = [f.statuses[1], f.statuses[2], f.statuses[0]].flatMap((status) =>
    rows
      .filter((row) => row.status_id === status)
      .map((row) => row.id)
      .sort(),
  );
  expect((await all(f)).map((row) => row.id)).toEqual(expected);
});

test.each(['asc', 'desc'])(
  'date %s keeps UUID ties stable and all nulls last',
  async (direction) => {
    const f = await setup();
    const rows = [];
    for (const date of [
      null,
      '2026-01-02T13:00:00.123Z',
      '2026-01-02T13:00:00.123Z',
      null,
      '2026-01-02T09:00:00.456Z',
    ])
      rows.push({ ...(await task(f, { due_date: date })), date });
    const dates =
      direction === 'asc'
        ? ['2026-01-02T09:00:00.456Z', '2026-01-02T13:00:00.123Z', null]
        : ['2026-01-02T13:00:00.123Z', '2026-01-02T09:00:00.456Z', null];
    const expected = dates.flatMap((date) =>
      rows
        .filter((row) => row.date === date)
        .map((row) => row.id)
        .sort(),
    );
    const actual = await all(f, { sort: 'dueDate', direction });
    expect(actual.map((row) => row.id)).toEqual(expected);
    for (const row of actual)
      expect(row.dueDate).toBe(rows.find((fixture) => fixture.id === row.id).date);
  },
);

test('typed JSONB filters preserve scalar types and contain individual multi-select options', async () => {
  const f = await setup();
  const option = { id: randomUUID(), label: 'One', color: '#123456' };
  const types = {
    checkbox: 'checkbox',
    date: 'date',
    multi: 'multi_select',
    number: 'number',
    single: 'single_select',
    text: 'text',
  };
  for (const [key, type] of Object.entries(types))
    await insert(postgres.client, 'field_definitions', {
      id: randomUUID(),
      workspace_id: f.workspaceId,
      owner_id: f.workspaceId,
      owner_type: 'workspace',
      key,
      name: key,
      type,
      options: JSON.stringify(['single', 'multi'].includes(key) ? [option] : []),
    });
  const good = await task(f, {
    custom_fields: JSON.stringify({
      text: '3',
      number: 3,
      checkbox: false,
      date: '2026-02-28',
      single: option.id,
      multi: [option.id],
    }),
  });
  await task(f, { custom_fields: JSON.stringify({ checkbox: true, number: '3', text: 'Other' }) });
  for (const [key, value] of Object.entries({
    text: '3',
    number: 3,
    checkbox: false,
    date: '2026-02-28',
    single: option.id,
    multi: option.id,
  })) {
    const rows = await all(f, {
      fieldKey: key,
      fieldOperator: key === 'multi' ? 'contains' : 'eq',
      fieldValue: JSON.stringify(value),
    });
    expect(rows.map((row) => row.id)).toEqual([good.id]);
  }
});

test('assignee predicates do not duplicate rows or disclose account metadata', async () => {
  const f = await setup();
  const second = await insert(postgres.client, 'users', {
    id: randomUUID(),
    email: `${randomUUID()}@example.test`,
    name: 'Second',
    password_hash: 'test-only',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: f.workspaceId,
    user_id: second.id,
    role: 'member',
  });
  const row = await task(f);
  for (const member of [user, second])
    await insert(postgres.client, 'task_assignees', {
      workspace_id: f.workspaceId,
      task_id: row.id,
      user_id: member.id,
    });
  const items = await all(f, { assigneeId: user.id });
  expect(items).toHaveLength(1);
  expect(items[0].assigneeIds).toEqual([user.id, second.id].sort());
  expect(items[0].assignees.map((assignee) => Object.keys(assignee).sort())).toEqual([
    ['id', 'name'],
    ['id', 'name'],
  ]);
});

test('task reads and both revisions remain in one snapshot during configuration changes', async () => {
  const f = await setup();
  await task(f);
  await database.read(f.context, async (store) => {
    const before = await store.tasks.revisions();
    await database.write(f.context, (writer) =>
      writer.fields.create(
        { ownerType: 'workspace', ownerId: f.workspaceId },
        {
          key: 'added',
          name: 'Added',
          type: 'text',
          required: false,
          options: [],
          position: 0,
          expectedConfigVersion: before.configVersion,
        },
      ),
    );
    expect(await store.tasks.revisions()).toEqual(before);
    expect(await store.tasks.list(f.listId, query())).toHaveLength(1);
  });
  expect((await database.read(f.context, (store) => store.tasks.revisions())).configVersion).toBe(
    2,
  );
});

test('archived tasks and ancestors are excluded and missing records are tenant scoped', async () => {
  const f = await setup();
  const row = await task(f, {
    created_at: new Date('2025-01-01'),
    archived_at: new Date('2026-01-01'),
  });
  expect(await all(f)).toEqual([]);
  await expect(database.read(f.context, (store) => store.tasks.find(row.id))).rejects.toMatchObject(
    { code: 'NOT_FOUND' },
  );
  const live = await task(f);
  await postgres.client.query('UPDATE nodes SET archived_at=clock_timestamp() WHERE id=$1', [
    f.listId,
  ]);
  await expect(
    database.read(f.context, (store) => store.tasks.find(live.id)),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    database.read(f.context, (store) => store.tasks.list(f.listId, query())),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('escaped text stays filterable and repository page limits remain bounded', async () => {
  const f = await setup();
  await insert(postgres.client, 'field_definitions', {
    id: randomUUID(),
    workspace_id: f.workspaceId,
    owner_id: f.workspaceId,
    owner_type: 'workspace',
    key: 'text',
    name: 'Text',
    type: 'text',
  });
  const text = '"'.repeat(2000);
  const row = await task(f, { custom_fields: JSON.stringify({ text }) });
  expect(
    (await all(f, { fieldKey: 'text', fieldOperator: 'eq', fieldValue: JSON.stringify(text) })).map(
      (item) => item.id,
    ),
  ).toEqual([row.id]);
  await expect(
    database.read(f.context, (store) => store.tasks.list(f.listId, { ...query(), limit: 101 })),
  ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
});
