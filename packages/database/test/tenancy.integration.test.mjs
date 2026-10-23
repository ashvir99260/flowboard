import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import * as databaseModule from '../dist/index.js';

import { fixtures } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let database;
let data;

beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  data = await fixtures(postgres.client);
  database = databaseModule.createDatabase(await applicationUrl(postgres));
});

afterAll(async () => {
  await database?.close();
  await postgres?.client.end();
  postgres?.stop();
});

test('the only public tenant read path excludes another workspace', async () => {
  const foreign = await database.read(
    { actorUserId: data.user.id, workspaceId: data.a.workspace.id },
    (view) => view.nodes.find(data.b.list.id),
  );
  expect(foreign).toBeNull();
});

const context = () => ({ actorUserId: data.user.id, workspaceId: data.a.workspace.id });

test('membership and role are reloaded from the database for each workspace', async () => {
  expect(await database.read(context(), async (view) => view.context.role)).toBe('admin');
  expect(
    await database.read(
      { ...context(), workspaceId: data.b.workspace.id },
      async (view) => view.context.role,
    ),
  ).toBe('member');
  await expect(
    database.read(
      { actorUserId: data.otherUser.id, workspaceId: data.a.workspace.id },
      async () => null,
    ),
  ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });
});

test.each([
  null,
  {},
  { actorUserId: 'invalid', workspaceId: 'invalid' },
  { actorUserId: randomUUID(), workspaceId: randomUUID(), role: 'admin' },
])('rejects missing or forged context: %j', async (input) => {
  await expect(database.read(input, async () => null)).rejects.toBeDefined();
});

test('pages, counts and anchors remain tenant scoped', async () => {
  const result = await database.read(context(), async (view) => ({
    count: await view.nodes.countChildren(null),
    page: await view.nodes.children({ limit: 1, parentId: null }),
  }));
  expect(result.count).toBe(1);
  expect(result.page.map((node) => node.id)).toEqual([data.a.space.id]);
  await expect(
    database.read(context(), (view) =>
      view.nodes.children({ afterId: data.b.space.id, parentId: null }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    database.read(context(), (view) => view.nodes.children({ parentId: data.b.folder.id })),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    database.read(context(), (view) =>
      view.nodes.children({ afterId: data.a.list.id, parentId: null }),
    ),
  ).rejects.toMatchObject({ code: 'INVALID_CURSOR' });
});

test.each([0, 101, 1.5, null])('rejects an invalid internal page limit: %j', async (limit) => {
  await expect(
    database.read(context(), (view) => view.nodes.children({ limit, parentId: null })),
  ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
});

test('does not silently accept an empty anchor or inherited context properties', async () => {
  await expect(
    database.read(context(), (view) => view.nodes.children({ afterId: '', parentId: null })),
  ).rejects.toBeDefined();
  await expect(database.read(Object.create(context()), async () => null)).rejects.toMatchObject({
    code: 'VALIDATION_FAILED',
  });
});

test('writes cannot inject a workspace or nested Prisma operation', async () => {
  const value = { name: 'Injected', parentId: null, type: 'space' };
  for (const injection of [
    { workspaceId: data.b.workspace.id },
    { parent: { connect: { id: data.b.space.id } } },
  ]) {
    await expect(
      database.write(context(), (tx) => tx.nodes.create({ ...value, ...injection })),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  }
  await expect(
    database.read(context(), (view) =>
      view.nodes.children({ parentId: null, workspaceId: data.b.workspace.id }),
    ),
  ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
});

test('foreign-tenant updates and relation creation leave both workspaces unchanged', async () => {
  await expect(
    database.write(context(), (tx) => tx.nodes.rename(data.b.list.id, 'Stolen')),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    database.write(context(), (tx) =>
      tx.nodes.create({ name: 'Foreign child', parentId: data.b.space.id, type: 'folder' }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(
    (await postgres.client.query('SELECT name FROM nodes WHERE id = $1', [data.b.list.id])).rows[0]
      .name,
  ).toBe('List');
});

test('grant lookup, mutation and deletion check both resource and membership', async () => {
  await expect(
    database.write(context(), (tx) =>
      tx.grants.set({ mode: 'allow', resourceId: data.b.list.id, userId: data.user.id }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    database.write(context(), (tx) =>
      tx.grants.set({ mode: 'allow', resourceId: data.a.list.id, userId: data.otherUser.id }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    database.write(context(), (tx) => tx.grants.remove(data.b.list.id, data.otherUser.id)),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(
    (await database.read(context(), (view) => view.grants.find(data.a.list.id, data.user.id))).mode,
  ).toBe('allow');
  await database.write(context(), async (tx) => {
    await tx.grants.set({ mode: 'deny', resourceId: data.a.list.id, userId: data.user.id });
    await tx.grants.remove(data.a.list.id, data.user.id);
  });
  expect(
    await database.read(context(), (view) => view.grants.find(data.a.list.id, data.user.id)),
  ).toBeNull();
  expect(
    (
      await postgres.client.query('SELECT mode FROM grants WHERE workspace_id = $1', [
        data.b.workspace.id,
      ])
    ).rows[0].mode,
  ).toBe('allow');
});

test('a failed transaction rolls back earlier scoped writes', async () => {
  const before = await database.read(context(), (view) => view.nodes.find(data.a.list.id));
  await expect(
    database.write(context(), async (tx) => {
      await tx.nodes.rename(data.a.list.id, 'Temporary');
      await tx.nodes.rename(data.b.list.id, 'Forbidden');
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await database.read(context(), (view) => view.nodes.find(data.a.list.id))).toEqual(before);
});

test('successful creation injects only the verified workspace and supports keyset continuation', async () => {
  const created = await database.write(context(), (tx) =>
    tx.nodes.create({ name: 'Second root', parentId: null, type: 'space' }),
  );
  expect(created.workspaceId).toBe(data.a.workspace.id);
  const pages = await database.read(context(), async (view) => {
    const first = await view.nodes.children({ limit: 1, parentId: null });
    const second = await view.nodes.children({ afterId: first[0].id, limit: 1, parentId: null });
    return [...first, ...second];
  });
  expect(new Set(pages.map((node) => node.id))).toEqual(new Set([data.a.space.id, created.id]));
});

test('case-insensitive UUIDs work across nested cursor pages', async () => {
  await database.write(context(), (tx) =>
    tx.nodes.create({
      name: 'Second list',
      parentId: data.a.folder.id,
      type: 'list',
    }),
  );
  const parentId = data.a.folder.id.toUpperCase();
  const pages = await database.read(context(), async (view) => {
    const first = await view.nodes.children({ limit: 1, parentId });
    const second = await view.nodes.children({ afterId: first[0].id, limit: 1, parentId });
    return [...first, ...second];
  });
  expect(new Set(pages.map((node) => node.id)).size).toBe(2);
});

test('read handles have no mutations and escaped transaction handles fail closed', async () => {
  const escaped = await database.read(context(), async (view) => view);
  expect(escaped.nodes.create).toBeUndefined();
  expect(escaped.grants.remove).toBeUndefined();
  await expect(escaped.nodes.find(data.a.list.id)).rejects.toMatchObject({
    code: 'INTERNAL_ERROR',
  });
  const write = await database.write(context(), async (tx) => tx);
  await expect(write.nodes.rename(data.a.list.id, 'Too late')).rejects.toMatchObject({
    code: 'INTERNAL_ERROR',
  });
  expect(databaseModule.PrismaClient).toBeUndefined();
  expect(databaseModule.createClient).toBeUndefined();
});

test('membership revocation wins over a write waiting for the workspace lock', async () => {
  await postgres.client.query('BEGIN');
  await postgres.client.query('SELECT id FROM workspaces WHERE id = $1 FOR UPDATE', [
    data.b.workspace.id,
  ]);
  const pending = database
    .write({ actorUserId: data.user.id, workspaceId: data.b.workspace.id }, (tx) =>
      tx.nodes.rename(data.b.list.id, 'After revocation'),
    )
    .then(
      () => null,
      (error) => error,
    );
  // Observe the actual blocked lock request, rather than relying on a timed race.
  let waiting = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await postgres.client.query('SELECT pg_stat_clear_snapshot()');
    const { rows } = await postgres.client.query(
      "SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%SELECT id FROM workspaces%'",
    );
    if (rows[0].count > 0) {
      waiting = true;
      break;
    }
    await setTimeout(10);
  }
  if (!waiting) {
    await postgres.client.query('ROLLBACK');
    await pending;
    throw new Error('The member write never waited for the workspace lock');
  }
  await postgres.client.query('DELETE FROM memberships WHERE user_id = $1 AND workspace_id = $2', [
    data.user.id,
    data.b.workspace.id,
  ]);
  await postgres.client.query('COMMIT');
  expect(await pending).toMatchObject({ code: 'MEMBERSHIP_REQUIRED' });
  expect(
    (await postgres.client.query('SELECT name FROM nodes WHERE id = $1', [data.b.list.id])).rows[0]
      .name,
  ).toBe('List');
});
