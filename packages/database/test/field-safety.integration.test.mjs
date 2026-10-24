import { randomUUID } from 'node:crypto';

import { WorkspaceConfigUpdatedEventSchema } from '@flowboard/contracts';
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
    email: 'field-safety@example.test',
    name: 'Field safety',
    password_hash: 'test-only-hash',
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
    name: 'Field safety',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'admin',
  });
  const context = { workspaceId: workspace.id, actorUserId: user.id };
  const root = { ownerType: 'workspace', ownerId: workspace.id };
  const nodes = [];
  for (const [type, parent] of [
    ['space', null],
    ['folder', 0],
    ['list', 1],
    ['list', 1],
  ])
    nodes.push(
      await insert(postgres.client, 'nodes', {
        id: randomUUID(),
        workspace_id: workspace.id,
        name: type,
        type,
        position: nodes.length,
        parent_id: parent === null ? null : nodes[parent].id,
      }),
    );
  const status = await insert(postgres.client, 'status_identities', {
    id: randomUUID(),
    workspace_id: workspace.id,
    key: 'todo',
    category: 'not_started',
  });

  return {
    workspace,
    context,
    root,
    nodes,
    status,
    folder: { ownerType: 'folder', ownerId: nodes[1].id },
    lists: nodes.slice(2).map((node) => ({ ownerType: 'list', ownerId: node.id })),
  };
}
async function field(f, owner = f.root, values = {}) {
  return insert(postgres.client, 'field_definitions', {
    id: randomUUID(),
    workspace_id: f.workspace.id,
    owner_id: owner.ownerId,
    owner_type: owner.ownerType,
    key: 'value',
    name: 'Value',
    type: 'number',
    ...values,
    options: JSON.stringify(values.options ?? []),
  });
}
async function task(f, values, list = f.lists[0], archived = false) {
  return insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: f.workspace.id,
    primary_list_id: list.ownerId,
    status_id: f.status.id,
    title: 'Field safety task',
    custom_fields: JSON.stringify(values),
    ...(archived
      ? {
          created_at: new Date('2025-01-01T00:00:00Z'),
          archived_at: new Date('2026-01-01T00:00:00Z'),
        }
      : {}),
  });
}
async function snapshot(f) {
  const value = {};
  for (const table of ['field_definitions', 'tasks', 'outbox_events'])
    value[table] = (
      await postgres.client.query(
        `SELECT to_jsonb(t) AS value FROM ${table} t WHERE workspace_id=$1 ORDER BY id`,
        [f.workspace.id],
      )
    ).rows;
  value.workspace = (
    await postgres.client.query('SELECT to_jsonb(w) AS value FROM workspaces w WHERE id=$1', [
      f.workspace.id,
    ])
  ).rows[0].value;

  return value;
}
const write = (f, action) => database.write(f.context, action);
const read = (f, action) => database.read(f.context, action);
const define = (key, version = 1) => ({
  key,
  name: key,
  type: 'text',
  required: false,
  options: [],
  position: 0,
  expectedConfigVersion: version,
});
const selection = () => ({ id: randomUUID(), label: 'Choice', color: '#123456' });
async function rejected(
  f,
  action,
  code = 'CONFIG_INVALIDATES_TASKS',
  path = ['customFields', 'value'],
) {
  const before = await snapshot(f);
  await expect(write(f, action)).rejects.toMatchObject({
    code,
    details: expect.arrayContaining([expect.objectContaining({ path })]),
  });
  expect(await snapshot(f)).toEqual(before);
}
async function changedOnce(f, before) {
  const after = await snapshot(f);
  expect(after.tasks).toEqual(before.tasks);
  expect(after.workspace.data_version).toBe(before.workspace.data_version);
  expect(after.workspace.config_version).toBe(before.workspace.config_version + 1);
  const events = after.outbox_events.filter(
    (event) => !before.outbox_events.some((old) => old.value.id === event.value.id),
  );
  expect(events).toHaveLength(1);
  expect(WorkspaceConfigUpdatedEventSchema.parse(events[0].value.payload)).toMatchObject({
    reason: 'field',
    workspaceId: f.workspace.id,
    configVersion: after.workspace.config_version,
  });

  return after;
}

test('ancestor changes validate unshadowed siblings but allow fully shadowed definitions', async () => {
  const f = await setup();
  const parent = await field(f);
  await field(f, f.lists[0], { type: 'text' });
  await task(f, { value: 'Text' });
  await task(f, { value: 2 }, f.lists[1]);
  await rejected(f, (store) =>
    store.fields.update(f.root, parent.id, { expectedConfigVersion: 1, type: 'checkbox' }),
  );
  await field(f, f.lists[1]);
  const before = await snapshot(f);
  const result = await write(f, (store) =>
    store.fields.update(f.root, parent.id, { expectedConfigVersion: 1, type: 'checkbox' }),
  );
  const updated = await changedOnce(f, before);
  expect(result.data.type).toBe('checkbox');
  expect((await read(f, (store) => store.fields.resolved(f.lists[0].ownerId))).items[0].type).toBe(
    'text',
  );
  expect((await read(f, (store) => store.fields.resolved(f.lists[1].ownerId))).items[0].type).toBe(
    'number',
  );
  await write(f, (store) => store.fields.remove(f.root, parent.id, { expectedConfigVersion: 2 }));
  await changedOnce(f, updated);
});

test.each(['type', 'required', 'options'])(
  'removing an override rejects incompatible %s fallback',
  async (kind) => {
    const f = await setup();
    const ownOption = selection();
    const configs = {
      type: { parent: { type: 'text' }, child: { type: 'number' }, values: { value: 3 } },
      required: {
        parent: { required: true, type: 'number' },
        child: { required: false, type: 'number' },
        values: {},
      },
      options: {
        parent: { type: 'single_select', options: [selection()] },
        child: { type: 'single_select', options: [ownOption] },
        values: { value: ownOption.id },
      },
    };
    const chosen = configs[kind];
    await field(f, f.root, chosen.parent);
    const child = await field(f, f.lists[0], chosen.child);
    await task(f, chosen.values);
    await rejected(f, (store) =>
      store.fields.remove(f.lists[0], child.id, { expectedConfigVersion: 1 }),
    );
  },
);

test.each([
  ['number', 0],
  ['checkbox', false],
])('required promotion retains legitimate %s zero/false values', async (type, value) => {
  const f = await setup();
  const root = await field(f, f.root, { type });
  await task(f, { value });
  await task(f, { value }, f.lists[1]);
  const before = await snapshot(f);
  const result = await write(f, (store) =>
    store.fields.update(f.root, root.id, { expectedConfigVersion: 1, required: true }),
  );
  expect(result.data.required).toBe(true);
  await changedOnce(f, before);
});

test.each([
  ['number', undefined, 0],
  ['text', '   ', 'Populated'],
  ['multi_select', [], 'option'],
])(
  'required promotion rejects invalid %s then succeeds after population',
  async (type, invalid, valid) => {
    const f = await setup();
    const option = selection();
    const root = await field(f, f.root, { type, options: type === 'multi_select' ? [option] : [] });
    const populated = valid === 'option' ? [option.id] : valid;
    await task(f, { value: populated });
    const affected = await task(f, invalid === undefined ? {} : { value: invalid }, f.lists[1]);
    await rejected(f, (store) =>
      store.fields.update(f.root, root.id, { expectedConfigVersion: 1, required: true }),
    );
    // Fixture population represents the task-edit workflow owned by P06.
    await postgres.client.query('UPDATE tasks SET custom_fields=$1::jsonb WHERE id=$2', [
      JSON.stringify({ value: populated }),
      affected.id,
    ]);
    const before = await snapshot(f);
    await write(f, (store) =>
      store.fields.update(f.root, root.id, { expectedConfigVersion: 1, required: true }),
    );
    await changedOnce(f, before);
  },
);

test.each([
  ['number', 0],
  ['checkbox', false],
  ['text', ''],
  ['multi_select', []],
])('stored falsy %s values still prevent effective field deletion', async (type, value) => {
  const f = await setup();
  const root = await field(f, f.root, { type });
  await task(f, { value });
  await rejected(
    f,
    (store) => store.fields.remove(f.root, root.id, { expectedConfigVersion: 1 }),
    'FIELD_IN_USE',
  );
});

test('removing a used multi-select option rejects with the exact array index', async () => {
  const f = await setup();
  const first = selection();
  const second = selection();
  const root = await field(f, f.root, { type: 'multi_select', options: [first, second] });
  await task(f, { value: [first.id, second.id] });
  await rejected(
    f,
    (store) => store.fields.update(f.root, root.id, { options: [first], expectedConfigVersion: 1 }),
    'CONFIG_INVALIDATES_TASKS',
    ['customFields', 'value', 1],
  );
});

test('empty descendants enforce effective and local field limits without blocking a replacement at the boundary', async () => {
  const f = await setup();
  await field(f, f.root, { key: 'inherited' });
  for (let index = 0; index < 99; index += 1) await field(f, f.folder, { key: `local_${index}` });
  const before = await snapshot(f);
  await expect(
    write(f, (store) => store.fields.create(f.root, define('overflow'))),
  ).rejects.toMatchObject({
    code: 'CONFIG_INVALIDATES_TASKS',
    details: expect.arrayContaining([
      expect.objectContaining({
        path: expect.arrayContaining([f.folder.ownerId]),
      }),
    ]),
  });
  expect(await snapshot(f)).toEqual(before);
  await write(f, (store) => store.fields.create(f.folder, define('inherited')));
  const bounded = await changedOnce(f, before);
  expect((await read(f, (store) => store.fields.resolved(f.lists[0].ownerId))).items).toHaveLength(
    100,
  );
  await expect(
    write(f, (store) => store.fields.create(f.folder, define('local_overflow', 2))),
  ).rejects.toMatchObject({ code: 'CONFIG_INVALIDATES_TASKS' });
  expect(await snapshot(f)).toEqual(bounded);
});

test('concurrent additions at capacity commit once and reject the stale configuration', async () => {
  const f = await setup();
  for (let index = 0; index < 99; index += 1) await field(f, f.root, { key: `base_${index}` });
  const before = await snapshot(f);
  const outcomes = await Promise.allSettled(
    ['racing_a', 'racing_b'].map((key) =>
      write(f, (store) => store.fields.create(f.root, define(key))),
    ),
  );
  expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
  expect(outcomes.find((outcome) => outcome.status === 'rejected').reason).toMatchObject({
    code: 'CONFIG_CONFLICT',
  });
  await changedOnce(f, before);
  expect((await read(f, (store) => store.fields.resolved(f.lists[0].ownerId))).items).toHaveLength(
    100,
  );
});

test('archived tasks and unreachable descendants keep history without blocking live configuration', async () => {
  const f = await setup();
  const root = await field(f);
  await task(f, { value: 0 });
  await task(f, { value: 'Historical' }, f.lists[1], true);
  const folder = await insert(postgres.client, 'nodes', {
    id: randomUUID(),
    workspace_id: f.workspace.id,
    parent_id: f.nodes[0].id,
    type: 'folder',
    name: 'Archived ancestor',
  });
  const list = await insert(postgres.client, 'nodes', {
    id: randomUUID(),
    workspace_id: f.workspace.id,
    parent_id: folder.id,
    type: 'list',
    name: 'Unreachable list',
  });
  await task(f, { value: 'Unreachable' }, { ownerType: 'list', ownerId: list.id });
  await postgres.client.query('UPDATE nodes SET archived_at=clock_timestamp() WHERE id=$1', [
    folder.id,
  ]);
  const before = await snapshot(f);
  await write(f, (store) =>
    store.fields.update(f.root, root.id, { expectedConfigVersion: 1, required: true }),
  );
  await changedOnce(f, before);
  await expect(read(f, (store) => store.fields.resolved(list.id))).rejects.toMatchObject({
    code: 'NOT_FOUND',
  });
  await expect(
    write(f, (store) =>
      store.fields.create({ ownerType: 'list', ownerId: list.id }, define('unreachable', 2)),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
