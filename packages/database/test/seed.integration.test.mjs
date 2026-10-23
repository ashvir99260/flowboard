import { CustomFieldOptionSchema } from '@flowboard/contracts';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import pg from 'pg';

import * as databaseModule from '../dist/index.js';
import { verifyPassword } from '../dist/password.js';

import { startPostgres } from './postgres.mjs';

let postgres;

beforeAll(async () => {
  postgres = await startPostgres();
});
afterAll(async () => {
  await postgres?.client.end();
  postgres?.stop();
});

test('two initializers migrate and seed once without duplicating data', async () => {
  const outcomes = await Promise.allSettled([
    databaseModule.initializeDatabase({ databaseUrl: postgres.connectionString, demoSeed: true }),
    databaseModule.initializeDatabase({ databaseUrl: postgres.connectionString, demoSeed: true }),
  ]);
  expect(outcomes).toEqual([
    { status: 'fulfilled', value: expect.any(Object) },
    { status: 'fulfilled', value: expect.any(Object) },
  ]);
  const results = outcomes.map((outcome) => outcome.value);
  expect(results.filter((result) => result.seeded)).toHaveLength(1);
  expect(
    (await postgres.client.query('SELECT count(*)::int AS count FROM seed_states')).rows[0].count,
  ).toBe(1);
  expect(
    (await postgres.client.query('SELECT count(*)::int AS count FROM tasks')).rows[0].count,
  ).toBeGreaterThanOrEqual(25);
});

test('demo topology, roles and grants cover both tenants', async () => {
  const { rows: workspaces } = await postgres.client.query(
    'SELECT * FROM workspaces ORDER BY name',
  );
  expect(workspaces).toHaveLength(2);
  const main = workspaces.find((workspace) => workspace.name === 'Flowboard Demo');
  const counts = await postgres.client.query(
    'SELECT type, count(*)::int AS count FROM nodes WHERE workspace_id = $1 GROUP BY type',
    [main.id],
  );
  expect(Object.fromEntries(counts.rows.map((row) => [row.type, row.count]))).toEqual({
    folder: 2,
    list: 3,
    space: 2,
  });
  const members = await postgres.client.query(
    'SELECT u.name, m.role, w.name AS workspace FROM memberships m JOIN users u ON u.id=m.user_id JOIN workspaces w ON w.id=m.workspace_id',
  );
  expect(members.rows).toContainEqual({
    name: 'Alice',
    role: 'admin',
    workspace: 'Flowboard Demo',
  });
  expect(members.rows).toContainEqual({ name: 'Alice', role: 'member', workspace: 'Other Tenant' });
  const grants = await postgres.client.query(
    'SELECT u.name, n.name AS resource, n.visibility, g.mode FROM grants g JOIN nodes n ON n.id=g.resource_id JOIN users u ON u.id=g.user_id',
  );
  expect(grants.rows).toContainEqual({
    mode: 'allow',
    name: 'Carol',
    resource: 'Private launch',
    visibility: 'private',
  });
  expect(grants.rows).toContainEqual({
    mode: 'deny',
    name: 'Bob',
    resource: 'Discovery',
    visibility: 'public',
  });
  expect(
    (
      await postgres.client.query(
        "SELECT count(*)::int AS count FROM task_assignees a JOIN users u ON u.id=a.user_id JOIN tasks t ON t.id=a.task_id JOIN nodes n ON n.id=t.primary_list_id WHERE u.name='Bob' AND n.name <> 'Product backlog'",
      )
    ).rows[0].count,
  ).toBe(0);
});

test('all seeded values fit their effective fields and visible status fixtures', async () => {
  const { rows: tasks } = await postgres.client.query(
    "SELECT t.*, n.name AS list, s.key AS status_key FROM tasks t JOIN nodes n ON n.id=t.primary_list_id JOIN status_identities s ON s.id=t.status_id JOIN workspaces w ON w.id=t.workspace_id WHERE w.name='Flowboard Demo'",
  );
  expect(tasks).toHaveLength(24);
  expect(new Set(tasks.map((task) => task.priority)).size).toBe(5);
  const { rows: selectFields } = await postgres.client.query(
    "SELECT owner_type, options FROM field_definitions WHERE type='single_select'",
  );
  for (const field of selectFields) {
    field.options.forEach((option) => CustomFieldOptionSchema.parse(option));
  }
  const idsFor = (ownerType) =>
    selectFields.find((field) => field.owner_type === ownerType).options.map((option) => option.id);
  for (const task of tasks) {
    expect(typeof task.custom_fields.effort).toBe('number');
    expect(task.custom_fields.effort).toBeGreaterThan(0);
    if (task.list === 'Product backlog') expect(idsFor('space')).toContain(task.custom_fields.team);
    if (task.list === 'Private launch') expect(idsFor('list')).toContain(task.custom_fields.team);
    if (task.list === 'Discovery') {
      expect(Object.keys(task.custom_fields)).toEqual(['effort']);
      expect(task.status_key).not.toBe('closed');
    }
  }
  const { rows: fields } = await postgres.client.query(
    'SELECT key, owner_type, required, type FROM field_definitions',
  );
  expect(fields).toHaveLength(4);
  expect(new Set(fields.map((field) => field.owner_type)).size).toBe(4);
  expect(fields).toContainEqual({
    key: 'effort',
    owner_type: 'workspace',
    required: true,
    type: 'number',
  });
  const { rows: overrides } = await postgres.client.query(
    "SELECT o.name, o.hidden, s.key FROM status_overrides o JOIN status_identities s ON s.id=o.status_id WHERE owner_type='list'",
  );
  expect(overrides).toContainEqual({ hidden: null, key: 'doing', name: 'In review' });
  expect(overrides).toContainEqual({ hidden: null, key: 'blocked', name: 'Blocked' });
  expect(overrides).toContainEqual({ hidden: true, key: 'closed', name: null });
});

test('demo credentials use individually salted Argon2id hashes', async () => {
  const { rows } = await postgres.client.query('SELECT password_hash FROM users');
  expect(new Set(rows.map((row) => row.password_hash)).size).toBe(4);
  for (const row of rows) {
    expect(row.password_hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(row.password_hash, databaseModule.DemoPassword)).toBe(true);
    expect(await verifyPassword(row.password_hash, 'wrong password')).toBe(false);
  }
});

test('later boots preserve edits and audit times without rewriting seed data', async () => {
  const {
    rows: [original],
  } = await postgres.client.query('SELECT id FROM tasks ORDER BY id LIMIT 1');
  const {
    rows: [edited],
  } = await postgres.client.query("UPDATE tasks SET title='Keep my edit' WHERE id=$1 RETURNING *", [
    original.id,
  ]);
  expect(
    await databaseModule.initializeDatabase({
      databaseUrl: postgres.connectionString,
      demoSeed: true,
    }),
  ).toEqual({ seeded: false });
  expect(
    (await postgres.client.query('SELECT * FROM tasks WHERE id=$1', [original.id])).rows[0],
  ).toEqual(edited);
});

test('disabled demo mode only migrates; seed failure rolls back and can retry', async () => {
  await postgres.client.query('CREATE DATABASE flowboard_seed_failure');
  const url = new URL(postgres.connectionString);
  url.pathname = '/flowboard_seed_failure';
  expect(await databaseModule.initializeDatabase({ databaseUrl: url.toString() })).toEqual({
    seeded: false,
  });
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    expect((await client.query('SELECT count(*)::int AS count FROM users')).rows[0].count).toBe(0);
    await client.query(
      "CREATE FUNCTION reject_seed_task() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_seed_task BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION reject_seed_task()",
    );
    await expect(databaseModule.seedDemoData(url.toString())).rejects.toBeDefined();
    expect((await client.query('SELECT count(*)::int AS count FROM users')).rows[0].count).toBe(0);
    expect(
      (await client.query('SELECT count(*)::int AS count FROM seed_states')).rows[0].count,
    ).toBe(0);
    await client.query('DROP TRIGGER reject_seed_task ON tasks; DROP FUNCTION reject_seed_task()');
    expect(await databaseModule.seedDemoData(url.toString())).toBe(true);
  } finally {
    await client.end();
  }
});
