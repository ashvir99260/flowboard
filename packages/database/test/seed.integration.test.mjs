import {
  CustomFieldOptionSchema,
  FieldValuesSchema,
  validateTaskFields,
} from '@flowboard/contracts';
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
    folder: 4,
    list: 6,
    space: 3,
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
  expect(members.rows.filter((member) => member.workspace === 'Flowboard Demo')).toHaveLength(5);
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
  expect(tasks).toHaveLength(48);
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
    expect(task.custom_fields.effort).toBeGreaterThanOrEqual(0);
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
  expect(fields).toHaveLength(9);
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

test('all six field types and every assignment are valid in the expanded workspace', async () => {
  const id = (value) => `f1000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
  const database = databaseModule.createDatabase(postgres.connectionString);
  try {
    const { rows: tasks } = await postgres.client.query(
      'SELECT * FROM tasks WHERE workspace_id=$1',
      [id(1)],
    );
    const { rows: assignments } = await postgres.client.query(
      'SELECT task_id,user_id FROM task_assignees WHERE workspace_id=$1',
      [id(1)],
    );
    const { rows: types } = await postgres.client.query(
      'SELECT DISTINCT type FROM field_definitions',
    );
    expect(types.map((row) => row.type).sort()).toEqual([
      'checkbox',
      'date',
      'multi_select',
      'number',
      'single_select',
      'text',
    ]);
    await database.read({ actorUserId: id(101), workspaceId: id(1) }, async (store) => {
      for (const listId of [...new Set(tasks.map((task) => task.primary_list_id))]) {
        const fields = await store.fields.resolved(listId);
        const statuses = await store.statuses.resolved(listId);
        if (listId === id(224))
          expect(statuses.items.map((status) => status.id)).toEqual(
            [400, 401, 406, 402, 403].map(id),
          );

        const assignees = await store.access.assignableMemberIds(listId);
        expect(fields.items.length).toBeGreaterThanOrEqual(2);
        for (const task of tasks.filter((item) => item.primary_list_id === listId)) {
          expect(
            validateTaskFields({
              fields: fields.items,
              values: FieldValuesSchema.parse(task.custom_fields),
            }),
          ).toEqual([]);
          expect(statuses.items.map((status) => status.id)).toContain(task.status_id);
          for (const assignment of assignments.filter((row) => row.task_id === task.id))
            expect(assignees).toContain(assignment.user_id);
        }
      }
    });
    expect(tasks.some((task) => task.custom_fields.verified === false)).toBe(true);
    expect(tasks.some((task) => task.custom_fields.effort === 0)).toBe(true);
    expect(tasks.some((task) => task.custom_fields.tags?.length === 2)).toBe(true);
    expect(
      tasks.some((task) => !assignments.some((assignment) => assignment.task_id === task.id)),
    ).toBe(true);
  } finally {
    await database.close();
  }
});

test('demo credentials use individually salted Argon2id hashes', async () => {
  const { rows } = await postgres.client.query('SELECT password_hash FROM users');
  expect(new Set(rows.map((row) => row.password_hash)).size).toBe(6);
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

test('an existing demo marker never triggers replacement or an automatic fixture upgrade', async () => {
  await postgres.client.query('CREATE DATABASE flowboard_seed_existing');
  const url = new URL(postgres.connectionString);
  url.pathname = '/flowboard_seed_existing';
  await databaseModule.initializeDatabase({ databaseUrl: url.toString() });
  const client = new pg.Client({ connectionString: url.toString() });
  await client.connect();
  try {
    await client.query("INSERT INTO seed_states(version) VALUES ('demo-v1')");
    await client.query(
      "INSERT INTO workspaces(id,name) VALUES ('f1000000-0000-4000-8000-000000000001','My edited workspace')",
    );
    const before = (await client.query('SELECT * FROM workspaces')).rows;
    expect(
      await databaseModule.initializeDatabase({ databaseUrl: url.toString(), demoSeed: true }),
    ).toEqual({ seeded: false });
    expect((await client.query('SELECT * FROM workspaces')).rows).toEqual(before);
    expect((await client.query('SELECT count(*)::int AS count FROM users')).rows[0].count).toBe(0);
    expect((await client.query('SELECT count(*)::int AS count FROM nodes')).rows[0].count).toBe(0);
  } finally {
    await client.end();
  }
});
