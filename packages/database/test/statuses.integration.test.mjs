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
    email: 'safety@example.test',
    name: 'Safety',
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
    name: 'Status safety',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'admin',
  });
  const context = { actorUserId: user.id, workspaceId: workspace.id };
  const root = { ownerType: 'workspace', ownerId: workspace.id };
  const nodes = [];
  for (const [type, parent] of [
    ['space', null],
    ['folder', 0],
    ['list', 1],
    ['list', 1],
  ]) {
    nodes.push(
      await insert(postgres.client, 'nodes', {
        id: randomUUID(),
        workspace_id: workspace.id,
        name: type,
        position: nodes.length,
        type,
        parent_id: parent === null ? null : nodes[parent].id,
      }),
    );
  }
  const fixture = {
    context,
    root,
    workspace,
    space: { ownerType: 'space', ownerId: nodes[0].id },
    folder: { ownerType: 'folder', ownerId: nodes[1].id },
    lists: nodes.slice(2).map((node) => ({ ownerType: 'list', ownerId: node.id })),
  };
  fixture.statuses = [];
  for (const [key, category] of [
    ['todo', 'not_started'],
    ['doing', 'active'],
    ['done', 'done'],
    ['closed', 'closed'],
  ])
    fixture.statuses.push(await definition(fixture, key, category));

  return fixture;
}
async function definition(fixture, key, category = 'active', scope = fixture.root) {
  const identity = await insert(postgres.client, 'status_identities', {
    id: randomUUID(),
    workspace_id: fixture.workspace.id,
    key,
    category,
  });
  await override(fixture, scope, identity.id, { name: key, color: '#123456', position: 0 });

  return identity;
}
async function override(fixture, scope, statusId, values) {
  return insert(postgres.client, 'status_overrides', {
    id: randomUUID(),
    workspace_id: fixture.workspace.id,
    owner_type: scope.ownerType,
    owner_id: scope.ownerId,
    status_id: statusId,
    ...values,
  });
}
async function task(fixture, statusId, list = fixture.lists[0], archived = false) {
  return insert(postgres.client, 'tasks', {
    id: randomUUID(),
    workspace_id: fixture.workspace.id,
    primary_list_id: list.ownerId,
    status_id: statusId,
    title: 'Reference',
    ...(archived
      ? {
          created_at: new Date('2025-01-01T00:00:00Z'),
          archived_at: new Date('2026-01-01T00:00:00Z'),
        }
      : {}),
  });
}
async function snapshot(fixture) {
  const value = {};
  for (const table of ['status_identities', 'status_overrides', 'tasks', 'outbox_events'])
    value[table] = (
      await postgres.client.query(
        `SELECT to_jsonb(t) AS value FROM ${table} t WHERE workspace_id=$1 ORDER BY id`,
        [fixture.workspace.id],
      )
    ).rows;
  value.workspace = (
    await postgres.client.query('SELECT to_jsonb(w) AS value FROM workspaces w WHERE id=$1', [
      fixture.workspace.id,
    ])
  ).rows;

  return value;
}
const write = (fixture, operation) => database.write(fixture.context, operation);
const read = (fixture, operation) => database.read(fixture.context, operation);

test.each(['create', 'update', 'remove'])(
  'a final outbox failure rolls back status %s and every related row',
  async (operation) => {
    const fixture = await setup();
    const marker = await insert(postgres.client, 'outbox_events', {
      id: randomUUID(),
      workspace_id: fixture.workspace.id,
      actor_id: user.id,
      aggregate_id: fixture.workspace.id,
      aggregate_type: 'workspace_config',
      aggregate_version: 2,
      event_type: 'workspace.config.updated',
      payload: '{}',
    });
    const before = await snapshot(fixture);
    const command = (store) =>
      operation === 'create'
        ? store.statuses.create(fixture.root, {
            category: 'active',
            color: '#123456',
            expectedConfigVersion: 1,
            key: 'review',
            kind: 'define',
            name: 'Review',
            position: 5,
          })
        : operation === 'update'
          ? store.statuses.update(fixture.root, fixture.statuses[0].id, {
              expectedConfigVersion: 1,
              name: 'Renamed',
            })
          : store.statuses.remove(fixture.root, fixture.statuses[3].id, {
              expectedConfigVersion: 1,
            });
    await expect(write(fixture, command)).rejects.toThrow();
    expect(await snapshot(fixture)).toEqual(before);
    await postgres.client.query('DELETE FROM outbox_events WHERE id=$1', [marker.id]);
    await write(fixture, command);
    const after = await snapshot(fixture);
    expect(after.workspace[0].value).toMatchObject({ config_version: 2, data_version: 1 });
    expect(after.outbox_events).toHaveLength(1);
    expect(
      WorkspaceConfigUpdatedEventSchema.parse(after.outbox_events[0].value.payload),
    ).toMatchObject({ reason: 'status', configVersion: 2, workspaceId: fixture.workspace.id });
  },
);

test('every affected descendant is checked, including an empty intermediate scope', async () => {
  const fixture = await setup();
  const secondary = await definition(fixture, 'secondary');
  await override(fixture, fixture.folder, fixture.statuses[1].id, { hidden: true });
  await override(fixture, fixture.lists[0], fixture.statuses[1].id, { hidden: false });
  const before = await snapshot(fixture);
  await expect(
    write(fixture, (store) =>
      store.statuses.update(fixture.root, secondary.id, { expectedConfigVersion: 1, hidden: true }),
    ),
  ).rejects.toMatchObject({
    code: 'CONFIG_INVALIDATES_TASKS',
    details: expect.arrayContaining([
      expect.objectContaining({ path: expect.arrayContaining([fixture.folder.ownerId]) }),
    ]),
  });
  expect(await snapshot(fixture)).toEqual(before);
  await task(fixture, fixture.statuses[3].id, fixture.lists[1]);
  await override(fixture, fixture.lists[0], fixture.statuses[3].id, { hidden: false });
  const withTask = await snapshot(fixture);
  await expect(
    write(fixture, (store) =>
      store.statuses.update(fixture.root, fixture.statuses[3].id, {
        expectedConfigVersion: 1,
        hidden: true,
      }),
    ),
  ).rejects.toMatchObject({ code: 'STATUS_IN_USE' });
  expect(await snapshot(fixture)).toEqual(withTask);
});

test('deletion validates partial descendants and preserves canonical task identities on fallback', async () => {
  const fixture = await setup();
  const original = await task(fixture, fixture.statuses[1].id);
  await override(fixture, fixture.lists[0], fixture.statuses[1].id, { name: 'In progress' });
  await write(fixture, (store) =>
    store.statuses.remove(fixture.lists[0], fixture.statuses[1].id, { expectedConfigVersion: 1 }),
  );
  expect((await snapshot(fixture)).tasks[0].value.status_id).toBe(original.status_id);
  const local = await definition(fixture, 'local', 'closed', fixture.space);
  await override(fixture, fixture.folder, local.id, { name: 'Partial' });
  const before = await snapshot(fixture);
  await expect(
    write(fixture, (store) =>
      store.statuses.remove(fixture.space, local.id, { expectedConfigVersion: 2 }),
    ),
  ).rejects.toMatchObject({ code: 'CONFIG_INVALIDATES_TASKS' });
  expect(await snapshot(fixture)).toEqual(before);
});

test('no-op patches preserve all timestamps and revisions but still reject stale versions', async () => {
  const fixture = await setup();
  await override(fixture, fixture.lists[0], fixture.statuses[1].id, {
    color: null,
    hidden: false,
    name: null,
    position: 0,
  });
  const before = await snapshot(fixture);
  await write(fixture, (store) =>
    store.statuses.update(fixture.lists[0], fixture.statuses[1].id, {
      color: null,
      expectedConfigVersion: 1,
      hidden: false,
      name: null,
      position: 0,
    }),
  );
  expect(await snapshot(fixture)).toEqual(before);
  await write(fixture, (store) =>
    store.statuses.update(fixture.root, fixture.statuses[0].id, {
      expectedConfigVersion: 1,
      name: 'Waiting',
    }),
  );
  const changed = await snapshot(fixture);
  await expect(
    write(fixture, (store) =>
      store.statuses.update(fixture.lists[0], fixture.statuses[1].id, {
        expectedConfigVersion: 1,
        hidden: false,
      }),
    ),
  ).rejects.toMatchObject({ code: 'CONFIG_CONFLICT' });
  expect(await snapshot(fixture)).toEqual(changed);
});

test('archived task references survive local removal and still prevent physical identity deletion', async () => {
  const fixture = await setup();
  const original = await task(fixture, fixture.statuses[3].id, fixture.lists[0], true);
  const before = await snapshot(fixture);
  await write(fixture, (store) =>
    store.statuses.remove(fixture.root, fixture.statuses[3].id, { expectedConfigVersion: 1 }),
  );
  const after = await snapshot(fixture);
  expect(after.tasks).toEqual(before.tasks);
  expect(after.status_identities).toEqual(before.status_identities);
  expect(after.tasks[0].value).toMatchObject({ id: original.id, status_id: original.status_id });
  expect(after.status_identities.some((row) => row.value.id === original.status_id)).toBe(true);
  await expect(
    postgres.client.query('DELETE FROM status_identities WHERE id=$1', [original.status_id]),
  ).rejects.toMatchObject({ code: '23503' });
  expect(await snapshot(fixture)).toEqual(after);
});

test('local and effective caps reject overflow without leaking identities or invalidations', async () => {
  const fixture = await setup();
  for (let index = 0; index < 96; index += 1) await definition(fixture, `extra_${index}`);
  expect(
    (await read(fixture, (store) => store.statuses.resolved(fixture.lists[0].ownerId))).items,
  ).toHaveLength(100);
  const addition = {
    category: 'active',
    color: '#123456',
    expectedConfigVersion: 1,
    key: 'overflow',
    kind: 'define',
    name: 'Overflow',
    position: 0,
  };
  const before = await snapshot(fixture);
  for (const scope of [fixture.root, fixture.lists[0]]) {
    await expect(
      write(fixture, (store) => store.statuses.create(scope, addition)),
    ).rejects.toMatchObject({ code: 'CONFIG_INVALIDATES_TASKS' });
    expect(await snapshot(fixture)).toEqual(before);
  }
  await write(fixture, (store) =>
    store.statuses.create(fixture.lists[0], {
      kind: 'override',
      statusId: fixture.statuses[1].id,
      name: 'At capacity',
      expectedConfigVersion: 1,
    }),
  );
  const hidden = await definition(fixture, 'hidden_extra', 'closed', fixture.lists[0]);
  await postgres.client.query(
    'UPDATE status_overrides SET hidden=true WHERE workspace_id=$1 AND status_id=$2',
    [fixture.workspace.id, hidden.id],
  );
  const beforeUnhide = await snapshot(fixture);
  await expect(
    write(fixture, (store) =>
      store.statuses.update(fixture.lists[0], hidden.id, {
        expectedConfigVersion: 2,
        hidden: false,
      }),
    ),
  ).rejects.toMatchObject({ code: 'CONFIG_INVALIDATES_TASKS' });
  expect(await snapshot(fixture)).toEqual(beforeUnhide);
  await postgres.client.query(
    'UPDATE status_overrides SET hidden=true WHERE workspace_id=$1 AND owner_type=$2 AND status_id NOT IN ($3,$4,$5)',
    [fixture.workspace.id, 'workspace', ...fixture.statuses.slice(0, 3).map((status) => status.id)],
  );
  const hiddenRoot = await snapshot(fixture);
  await expect(
    write(fixture, (store) =>
      store.statuses.create(fixture.root, { ...addition, expectedConfigVersion: 2 }),
    ),
  ).rejects.toMatchObject({ code: 'CONFIG_INVALIDATES_TASKS' });
  expect(await snapshot(fixture)).toEqual(hiddenRoot);
});

test('competing hides cannot remove the last active category', async () => {
  const fixture = await setup();
  const secondary = await definition(fixture, 'secondary');
  const results = await Promise.allSettled(
    [fixture.statuses[1], secondary].map((status) =>
      write(fixture, (store) =>
        store.statuses.update(fixture.root, status.id, { expectedConfigVersion: 1, hidden: true }),
      ),
    ),
  );
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected').reason).toMatchObject({
    code: 'CONFIG_CONFLICT',
  });
  const resolved = await read(fixture, (store) =>
    store.statuses.resolved(fixture.lists[0].ownerId),
  );
  expect(resolved.items.filter((status) => status.category === 'active')).toHaveLength(1);
  const after = await snapshot(fixture);
  expect(after.workspace[0].value).toMatchObject({ config_version: 2, data_version: 1 });
  expect(after.outbox_events).toHaveLength(1);
});
