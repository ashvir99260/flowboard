import { randomUUID } from 'node:crypto';

import { WorkspaceConfigUpdatedEventSchema } from '@flowboard/contracts';
import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createDatabase, seedDemoData } from '../dist/index.js';

import { insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const context = { actorUserId: id(101), workspaceId: id(1) };
const root = { ownerType: 'workspace', ownerId: id(1) };
let postgres;
let database;
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
const definition = (key, expectedConfigVersion) => ({
  key,
  name: key,
  type: 'text',
  required: false,
  options: [],
  position: 0,
  expectedConfigVersion,
});
async function snapshot() {
  const value = {};
  for (const table of ['field_definitions', 'tasks', 'outbox_events'])
    value[table] = (
      await postgres.client.query(
        `SELECT to_jsonb(t) AS value FROM ${table} t WHERE workspace_id=$1 ORDER BY id`,
        [id(1)],
      )
    ).rows;
  value.workspace = (
    await postgres.client.query('SELECT to_jsonb(w) AS value FROM workspaces w WHERE id=$1', [
      id(1),
    ])
  ).rows;

  return value;
}

test.each(['create', 'update', 'remove'])(
  'a final outbox failure rolls back field %s, versions and tasks',
  async (operation) => {
    const existing = await insert(postgres.client, 'field_definitions', {
      id: randomUUID(),
      workspace_id: id(1),
      owner_id: id(1),
      owner_type: 'workspace',
      key: 'temporary',
      name: 'Temporary',
      type: 'text',
    });
    const initial = await database.read(context, (store) => store.fields.local(root));
    const marker = await insert(postgres.client, 'outbox_events', {
      id: randomUUID(),
      workspace_id: id(1),
      actor_id: id(101),
      aggregate_id: id(1),
      aggregate_type: 'workspace_config',
      aggregate_version: initial.configVersion + 1,
      event_type: 'workspace.config.updated',
      payload: '{}',
    });
    try {
      const before = await snapshot();
      const input = { expectedConfigVersion: initial.configVersion };
      const commands = {
        create: (store) => store.fields.create(root, definition('rollback', initial.configVersion)),
        update: (store) => store.fields.update(root, existing.id, { ...input, name: 'Updated' }),
        remove: (store) => store.fields.remove(root, existing.id, input),
      };
      await expect(database.write(context, commands[operation])).rejects.toBeDefined();
      expect(await snapshot()).toEqual(before);
    } finally {
      await postgres.client.query('DELETE FROM outbox_events WHERE id=$1', [marker.id]);
      await postgres.client.query('DELETE FROM field_definitions WHERE id=$1', [existing.id]);
    }
  },
);

test('changed writes emit one typed config event; no-ops and rejections emit none or task revisions', async () => {
  const before = await snapshot();
  const current = await database.read(context, (store) => store.fields.local(root));
  const created = await database.write(context, (store) =>
    store.fields.create(root, definition('event_check', current.configVersion)),
  );
  const changed = await snapshot();
  expect(changed.tasks).toEqual(before.tasks);
  expect(changed.workspace[0].value.data_version).toBe(before.workspace[0].value.data_version);
  expect(changed.outbox_events).toHaveLength(before.outbox_events.length + 1);
  const event = changed.outbox_events.find(
    (entry) => !before.outbox_events.some((previous) => previous.value.id === entry.value.id),
  ).value;
  expect(WorkspaceConfigUpdatedEventSchema.parse(event.payload)).toMatchObject({
    reason: 'field',
    workspaceId: id(1),
    configVersion: created.configVersion,
  });
  expect(
    await database.write(context, (store) =>
      store.fields.update(root, created.data.id, {
        name: created.data.name,
        expectedConfigVersion: created.configVersion,
      }),
    ),
  ).toEqual(created);
  await expect(
    database.write(context, (store) =>
      store.fields.update(root, created.data.id, {
        name: created.data.name,
        expectedConfigVersion: current.configVersion,
      }),
    ),
  ).rejects.toMatchObject({ code: 'CONFIG_CONFLICT' });
  expect(await snapshot()).toEqual(changed);
});

test('repository reads reject foreign owners and ids, and return an empty schema for a new workspace', async () => {
  await expect(
    database.read(context, (store) =>
      store.fields.local({ ownerType: 'workspace', ownerId: id(2) }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    database.read(context, (store) => store.fields.resolved(id(321))),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const foreign = await insert(postgres.client, 'field_definitions', {
    id: randomUUID(),
    workspace_id: id(2),
    owner_id: id(2),
    owner_type: 'workspace',
    key: 'foreign',
    name: 'Foreign',
    type: 'text',
  });
  const current = await database.read(context, (store) => store.fields.local(root));
  await expect(
    database.write(context, (store) =>
      store.fields.update(root, foreign.id, {
        name: 'Not allowed',
        expectedConfigVersion: current.configVersion,
      }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  const persisted = await postgres.client.query('SELECT name FROM field_definitions WHERE id=$1', [
    foreign.id,
  ]);
  expect(persisted.rows).toEqual([{ name: 'Foreign' }]);
  const workspace = await insert(postgres.client, 'workspaces', {
    id: randomUUID(),
    name: 'Empty fields',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: workspace.id,
    user_id: id(101),
    role: 'admin',
  });
  const local = await database.read({ actorUserId: id(101), workspaceId: workspace.id }, (store) =>
    store.fields.local({ ownerType: 'workspace', ownerId: workspace.id }),
  );
  expect(local).toEqual({ items: [], ancestorScopes: [], configVersion: 1 });
});
