import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createClient } from '../dist/client.js';
import { verifyDatabaseConnection } from '../dist/index.js';

import { fixtures, insert } from './fixtures.mjs';
import { migrate, startPostgres } from './postgres.mjs';

let database;
let data;

beforeAll(async () => {
  database = await startPostgres();
  migrate(database.connectionString);
  data = await fixtures(database.client);
});

test('all fifteen tables start with equal audit timestamps and reject createdAt mutation', async () => {
  const { rows: tables } = await database.client.query(`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'created_at' ORDER BY table_name
  `);
  for (const { table_name: table } of tables) {
    const before = (
      await database.client.query(`SELECT created_at, updated_at FROM "${table}" LIMIT 1`)
    ).rows[0];
    expect(before.updated_at).toEqual(before.created_at);
    await expect(
      database.client.query(`UPDATE "${table}" SET created_at = created_at - INTERVAL '1 day'`),
    ).rejects.toMatchObject({ code: '23514' });
    const updated = (
      await database.client.query(
        `UPDATE "${table}" SET updated_at = updated_at RETURNING created_at, updated_at`,
      )
    ).rows[0];
    expect(updated.created_at).toEqual(before.created_at);
    expect(updated.updated_at.getTime()).toBeGreaterThan(before.updated_at.getTime());
    const read = (
      await database.client.query(`SELECT created_at, updated_at FROM "${table}" LIMIT 1`)
    ).rows[0];
    expect(read).toEqual(updated);
  }
});

test('Prisma uses the driver adapter and respects database-owned timestamps', async () => {
  await verifyDatabaseConnection(database.connectionString);
  const prisma = createClient(database.connectionString);
  try {
    const before = await prisma.task.findUniqueOrThrow({ where: { id: data.a.task.id } });
    const updated = await prisma.task.update({
      data: { title: 'Updated through Prisma' },
      where: { id: data.a.task.id },
    });
    expect(updated.createdAt).toEqual(before.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  } finally {
    await prisma.$disconnect();
  }
});

test.each([
  [
    'parent',
    'UPDATE nodes SET parent_id = $1 WHERE id = $2',
    () => [data.b.space.id, data.a.folder.id],
  ],
  [
    'task list',
    'UPDATE tasks SET primary_list_id = $1 WHERE id = $2',
    () => [data.b.list.id, data.a.task.id],
  ],
  [
    'task status',
    'UPDATE tasks SET status_id = $1 WHERE id = $2',
    () => [data.b.status.id, data.a.task.id],
  ],
  [
    'override status',
    'UPDATE status_overrides SET status_id = $1 WHERE workspace_id = $2',
    () => [data.b.status.id, data.a.workspace.id],
  ],
  [
    'grant resource',
    'UPDATE grants SET resource_id = $1 WHERE workspace_id = $2',
    () => [data.b.list.id, data.a.workspace.id],
  ],
  [
    'grant member',
    'UPDATE grants SET user_id = $1 WHERE workspace_id = $2',
    () => [data.otherUser.id, data.a.workspace.id],
  ],
  [
    'assignment task',
    'UPDATE task_assignees SET task_id = $1 WHERE workspace_id = $2',
    () => [data.b.task.id, data.a.workspace.id],
  ],
  [
    'assignment member',
    'UPDATE task_assignees SET user_id = $1 WHERE workspace_id = $2',
    () => [data.otherUser.id, data.a.workspace.id],
  ],
  [
    'activity task',
    'UPDATE activities SET task_id = $1 WHERE workspace_id = $2',
    () => [data.b.task.id, data.a.workspace.id],
  ],
  [
    'activity event',
    'UPDATE activities SET event_id = $1 WHERE workspace_id = $2',
    () => [data.b.unusedEvent.id, data.a.workspace.id],
  ],
])('rejects a foreign-tenant %s link', async (_, sql, parameters) => {
  await expect(database.client.query(sql, parameters())).rejects.toMatchObject({ code: '23503' });
});

test.each([
  ['empty name', "UPDATE nodes SET name = E' \\t'"],
  ['negative position', 'UPDATE tasks SET position = -1'],
  ['zero version', 'UPDATE nodes SET version = 0'],
  ['zero revision', 'UPDATE workspaces SET config_version = 0'],
  ['root folder', "UPDATE nodes SET parent_id = NULL WHERE type = 'folder'"],
  ['space with parent', "UPDATE nodes SET parent_id = id WHERE type = 'space'"],
  ['self parent', "UPDATE nodes SET parent_id = id WHERE type = 'folder'"],
  ['oversized title', "UPDATE tasks SET title = repeat('😀', 501)"],
  ['blank title', "UPDATE tasks SET title = E'\\n\\t'"],
  ['array task fields', "UPDATE tasks SET custom_fields = '[]'"],
  ['non-array options', "UPDATE field_definitions SET options = '{}'"],
  ['foreign workspace field owner', 'UPDATE field_definitions SET owner_id = gen_random_uuid()'],
  ['foreign workspace status owner', 'UPDATE status_overrides SET owner_id = gen_random_uuid()'],
  ['invalid color', "UPDATE status_overrides SET color = 'red'"],
  ['invalid digest', "UPDATE refresh_sessions SET token_digest = 'secret'"],
  [
    'expired at creation',
    "UPDATE refresh_sessions SET expires_at = created_at - INTERVAL '1 second'",
  ],
  ['unpaired invitation acceptance', 'UPDATE invitations SET accepted_at = clock_timestamp()'],
  [
    'self replacement',
    'UPDATE refresh_sessions SET used_at = clock_timestamp(), replaced_by_id = id',
  ],
  ['negative event attempt', 'UPDATE outbox_events SET attempts = -1'],
  ['unleased processing', "UPDATE outbox_events SET state = 'processing'"],
  ['unleased dispatching', "UPDATE outbox_events SET state = 'dispatching'"],
  [
    'queued with a lease',
    "UPDATE outbox_events SET state = 'queued', lease_owner = 'dispatcher', lease_until = clock_timestamp() + INTERVAL '1 second'",
  ],
  ['unpaired lease', "UPDATE outbox_events SET lease_owner = 'worker'"],
  ['incomplete delivery', "UPDATE outbox_events SET state = 'delivered'"],
  ['unexpected completion', 'UPDATE outbox_events SET completed_at = clock_timestamp()'],
  ['array event payload', "UPDATE outbox_events SET payload = '[]'"],
  ['array activity payload', "UPDATE activities SET payload = '[]'"],
])('rejects %s', async (_, sql) => {
  await expect(database.client.query(sql)).rejects.toMatchObject({ code: '23514' });
});

test('accepts 500 Unicode code points and retains nullable inheritance', async () => {
  await database.client.query('UPDATE tasks SET title = $1 WHERE id = $2', [
    '😀'.repeat(500),
    data.a.task.id,
  ]);
  const { rows } = await database.client.query(
    'SELECT hidden, name, color, position FROM status_overrides',
  );
  expect(rows.every((row) => Object.values(row).every((value) => value === null))).toBe(true);
});

test('PostgreSQL rejects unsupported enum values and preserves priority ordering', async () => {
  await expect(
    database.client.query("UPDATE tasks SET priority = 'critical'"),
  ).rejects.toMatchObject({ code: '22P02' });
  const { rows } = await database.client.query(
    'SELECT enum_range(NULL::"Priority")::text AS values',
  );
  expect(rows[0].values).toBe('{urgent,high,normal,low,none}');
});

test('unique keys and referenced statuses cannot be removed or duplicated', async () => {
  await expect(
    insert(database.client, 'memberships', {
      role: 'member',
      user_id: data.user.id,
      workspace_id: data.a.workspace.id,
    }),
  ).rejects.toMatchObject({ code: '23505' });
  await expect(
    database.client.query('DELETE FROM status_identities WHERE id = $1', [data.a.status.id]),
  ).rejects.toMatchObject({ code: '23503' });
  await expect(
    insert(database.client, 'field_definitions', {
      id: randomUUID(),
      key: 'size',
      name: 'Duplicate',
      owner_id: data.a.workspace.id,
      owner_type: 'workspace',
      type: 'text',
      workspace_id: data.a.workspace.id,
    }),
  ).rejects.toMatchObject({ code: '23505' });
});

test('refresh rotation requires consume, insert, link and preserves the family lineage', async () => {
  const replacement = { ...data.session, id: randomUUID(), token_digest: 'c'.repeat(64) };
  delete replacement.created_at;
  delete replacement.updated_at;
  await expect(insert(database.client, 'refresh_sessions', replacement)).rejects.toMatchObject({
    code: '23505',
  });
  await expect(
    database.client.query(
      'UPDATE refresh_sessions SET used_at = clock_timestamp(), replaced_by_id = $1 WHERE id = $2',
      [replacement.id, data.session.id],
    ),
  ).rejects.toMatchObject({ code: '23503' });
  await database.client.query('BEGIN');
  try {
    await database.client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [data.user.id]);
    await database.client.query(
      'UPDATE refresh_sessions SET used_at = clock_timestamp() WHERE id = $1',
      [data.session.id],
    );
    await insert(database.client, 'refresh_sessions', replacement);
    await database.client.query('UPDATE refresh_sessions SET replaced_by_id = $1 WHERE id = $2', [
      replacement.id,
      data.session.id,
    ]);
    await database.client.query('COMMIT');
  } catch (error) {
    await database.client.query('ROLLBACK');
    throw error;
  }
  const foreign = await insert(database.client, 'refresh_sessions', {
    expires_at: replacement.expires_at,
    family_id: randomUUID(),
    id: randomUUID(),
    token_digest: 'd'.repeat(64),
    user_id: data.otherUser.id,
  });
  await expect(
    database.client.query('UPDATE refresh_sessions SET replaced_by_id = $1 WHERE id = $2', [
      foreign.id,
      data.session.id,
    ]),
  ).rejects.toMatchObject({ code: '23503' });
  await expect(
    database.client.query('UPDATE refresh_sessions SET active_workspace_id = $1', [randomUUID()]),
  ).rejects.toMatchObject({ code: '23503' });
});

test('migration reapplication preserves records and required indexes', async () => {
  const before = (await database.client.query('SELECT count(*) FROM tasks')).rows;
  await database.restart();
  migrate(database.connectionString);
  expect((await database.client.query('SELECT count(*) FROM tasks')).rows).toEqual(before);
  const { rows } = await database.client.query(
    "SELECT indexdef FROM pg_indexes WHERE schemaname = 'public'",
  );
  for (const fragment of [
    '(family_id) WHERE',
    'primary_list_id, archived_at, status_id,',
    'primary_list_id, archived_at, due_date,',
    'primary_list_id, archived_at, priority,',
    'workspace_id, task_id, created_at,',
    'state, next_attempt_at,',
    'state, lease_until,',
  ]) {
    expect(rows.some((row) => row.indexdef.includes(fragment))).toBe(true);
  }
});

afterAll(async () => {
  await database?.client.end();
  database?.stop();
});

test('the migration creates all fifteen domain tables with database-owned audit columns', async () => {
  const { rows } = await database.client.query(`
    SELECT table_name, column_name, is_nullable, datetime_precision
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name IN ('created_at', 'updated_at')
    ORDER BY table_name, column_name
  `);
  expect(rows).toHaveLength(30);
  expect(new Set(rows.map((row) => row.table_name)).size).toBe(15);
  expect(rows.every((row) => row.is_nullable === 'NO' && row.datetime_precision === 3)).toBe(true);
  const columns = await database.client.query(`
    SELECT count(*)::int AS count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name <> '_prisma_migrations'
  `);
  expect(columns.rows[0].count).toBe(136);
});
