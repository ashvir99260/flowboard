import { createHash, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createDatabase, createIdentityRepository } from '../dist/index.js';

import { fixtures, insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let database;
let identities;
let data;
const digest = () => createHash('sha256').update(randomUUID()).digest('hex');
beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  data = await fixtures(postgres.client);
  const url = await applicationUrl(postgres);
  database = createDatabase(url);
  identities = createIdentityRepository(url);
});
afterAll(async () => {
  await Promise.all([database?.close(), identities?.close()]);
  await postgres?.client.end();
  postgres?.stop();
});

test('uppercase member removal cleans assignments and records the actual resulting assignees', async () => {
  const workspaceId = data.a.workspace.id;
  await database.write({ workspaceId, actorUserId: data.user.id }, (store) =>
    store.memberships.add({ email: data.otherUser.email, role: 'admin', expectedConfigVersion: 1 }),
  );
  await database.write({ workspaceId, actorUserId: data.otherUser.id }, (store) =>
    store.memberships.remove(data.user.id.toUpperCase(), 2),
  );
  const count = async (table) =>
    (
      await postgres.client.query(
        `SELECT count(*)::int AS n FROM ${table} WHERE workspace_id=$1 AND user_id=$2`,
        [workspaceId, data.user.id],
      )
    ).rows[0].n;
  expect(await count('memberships')).toBe(0);
  expect(await count('grants')).toBe(0);
  expect(await count('task_assignees')).toBe(0);
  const task = (
    await postgres.client.query('SELECT version FROM tasks WHERE id=$1', [data.a.task.id])
  ).rows[0];
  expect(task.version).toBe(2);
  const event = (
    await postgres.client.query(
      "SELECT payload FROM outbox_events WHERE workspace_id=$1 AND aggregate_type='task' AND aggregate_version=2",
      [workspaceId],
    )
  ).rows[0];
  expect(event.payload.changes.assigneeIds).toEqual({ before: [data.user.id], after: [] });
  expect(event.payload.taskVersion).toBe(2);
  expect(
    (
      await postgres.client.query(
        'SELECT count(*)::int AS n FROM activities WHERE workspace_id=$1',
        [workspaceId],
      )
    ).rows[0].n,
  ).toBe(1);
  expect(
    (
      await postgres.client.query(
        'SELECT config_version,data_version FROM workspaces WHERE id=$1',
        [workspaceId],
      )
    ).rows[0],
  ).toEqual({ config_version: 3, data_version: 2 });
});

test('switching that waits beyond family expiry cannot consume or change its credential', async () => {
  const tokenDigest = digest();
  const familyId = randomUUID();
  await insert(postgres.client, 'refresh_sessions', {
    id: randomUUID(),
    user_id: data.otherUser.id,
    family_id: familyId,
    active_workspace_id: data.b.workspace.id,
    token_digest: tokenDigest,
    expires_at: new Date(Date.now() + 60_000),
  });
  await postgres.client.query('BEGIN');
  let pending;
  try {
    await postgres.client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [
      data.a.workspace.id,
    ]);
    await postgres.client.query(
      "UPDATE refresh_sessions SET expires_at=clock_timestamp()+interval '2 seconds' WHERE token_digest=$1",
      [tokenDigest],
    );
    // Make the shortened lifetime visible before taking the destination lock.
    await postgres.client.query('COMMIT');
    await postgres.client.query('BEGIN');
    await postgres.client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [
      data.a.workspace.id,
    ]);
    pending = identities.switchWorkspace(
      { userId: data.otherUser.id, familyId, workspaceId: data.b.workspace.id },
      tokenDigest,
      digest(),
      data.a.workspace.id,
    );
    let blocked = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const waits = await postgres.client.query(
        'SELECT 1 FROM pg_locks WHERE granted=false AND pid<>pg_backend_pid()',
      );
      if (waits.rowCount) {
        blocked = true;
        break;
      }

      await setTimeout(10);
    }
    expect(blocked).toBe(true);
    await setTimeout(2100);
    await postgres.client.query('COMMIT');
    expect(await pending).toEqual({ status: 'invalid' });
    const rows = (
      await postgres.client.query(
        'SELECT active_workspace_id,used_at FROM refresh_sessions WHERE family_id=$1',
        [familyId],
      )
    ).rows;
    expect(rows).toEqual([{ active_workspace_id: data.b.workspace.id, used_at: null }]);
  } finally {
    await postgres.client.query('ROLLBACK');
    await pending?.catch(() => {});
  }
});

test('departure cleanup rolls back grants, assignments and revisions when outbox insertion fails', async () => {
  const workspaceId = data.b.workspace.id;
  await insert(postgres.client, 'task_assignees', {
    workspace_id: workspaceId,
    task_id: data.b.task.id,
    user_id: data.user.id,
  });
  await insert(postgres.client, 'grants', {
    workspace_id: workspaceId,
    resource_id: data.b.list.id,
    user_id: data.user.id,
    mode: 'allow',
  });
  await postgres.client.query(
    "CREATE FUNCTION reject_departure_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test event failure'; END $$; CREATE TRIGGER reject_departure_event BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_departure_event()",
  );
  try {
    await expect(
      database.write({ workspaceId, actorUserId: data.otherUser.id }, (store) =>
        store.memberships.remove(data.user.id, 1),
      ),
    ).rejects.toBeDefined();
  } finally {
    await postgres.client.query(
      'DROP TRIGGER reject_departure_event ON outbox_events; DROP FUNCTION reject_departure_event()',
    );
  }
  for (const table of ['memberships', 'grants', 'task_assignees']) {
    const { rows } = await postgres.client.query(
      `SELECT count(*)::int AS n FROM ${table} WHERE workspace_id=$1 AND user_id=$2`,
      [workspaceId, data.user.id],
    );
    expect(rows[0].n).toBe(1);
  }
  expect(
    (await postgres.client.query('SELECT version FROM tasks WHERE id=$1', [data.b.task.id])).rows[0]
      .version,
  ).toBe(1);
  expect(
    (
      await postgres.client.query(
        'SELECT config_version,data_version FROM workspaces WHERE id=$1',
        [workspaceId],
      )
    ).rows[0],
  ).toEqual({ config_version: 1, data_version: 1 });
});

test('expired and concurrently accepted invitations cannot add or upgrade membership twice', async () => {
  const user = await insert(postgres.client, 'users', {
    id: randomUUID(),
    name: 'Invited User',
    email: 'invited@example.test',
    password_hash: 'test-only',
  });
  const makeSession = async () => {
    const row = await insert(postgres.client, 'refresh_sessions', {
      id: randomUUID(),
      user_id: user.id,
      family_id: randomUUID(),
      token_digest: digest(),
      expires_at: new Date(Date.now() + 86_400_000),
    });

    return { userId: user.id, familyId: row.family_id, workspaceId: null };
  };
  const first = await makeSession();
  const second = await makeSession();
  expect((await identities.authenticate(first, true)).activeWorkspace).toBeNull();
  const context = { workspaceId: data.b.workspace.id, actorUserId: data.otherUser.id };
  const expiredDigest = digest();
  await insert(postgres.client, 'invitations', {
    id: randomUUID(),
    workspace_id: context.workspaceId,
    email: user.email,
    role: 'member',
    token_digest: expiredDigest,
    created_by_id: context.actorUserId,
    created_at: new Date(Date.now() - 3 * 86_400_000),
    updated_at: new Date(Date.now() - 3 * 86_400_000),
    expires_at: new Date(Date.now() - 86_400_000),
  });
  await expect(identities.acceptInvitation(first, expiredDigest)).rejects.toMatchObject({
    code: 'INVITATION_UNAVAILABLE',
  });
  const liveDigest = digest();
  const live = await database.write(context, (store) =>
    store.memberships.invite(
      { email: user.email, role: 'member', expectedConfigVersion: 1 },
      liveDigest,
    ),
  );
  const results = await Promise.allSettled([
    identities.acceptInvitation(first, liveDigest),
    identities.acceptInvitation(second, liveDigest),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected').reason.code).toBe(
    'INVITATION_UNAVAILABLE',
  );
  expect(
    (
      await postgres.client.query(
        'SELECT role FROM memberships WHERE workspace_id=$1 AND user_id=$2',
        [context.workspaceId, user.id],
      )
    ).rows,
  ).toEqual([{ role: 'member' }]);
  const stored = (
    await postgres.client.query('SELECT token_digest,accepted_by_id FROM invitations WHERE id=$1', [
      live.invitation.id,
    ])
  ).rows[0];
  expect(stored).toEqual({ token_digest: liveDigest, accepted_by_id: user.id });
  const upgradeDigest = digest();
  await database.write(context, (store) =>
    store.memberships.invite(
      { email: user.email, role: 'admin', expectedConfigVersion: 3 },
      upgradeDigest,
    ),
  );
  await expect(identities.acceptInvitation(first, upgradeDigest)).rejects.toMatchObject({
    code: 'INVITATION_UNAVAILABLE',
  });
  expect((await identities.authenticate(first, true)).activeWorkspace).toBeNull();
  const switched = await identities.switchWorkspace(
    first,
    (
      await postgres.client.query('SELECT token_digest FROM refresh_sessions WHERE family_id=$1', [
        first.familyId,
      ])
    ).rows[0].token_digest,
    digest(),
    context.workspaceId,
  );
  expect(switched.status).toBe('rotated');
  expect(switched.session.activeWorkspace.role).toBe('member');
});

test('member insertion can finish while a switch waits for the same workspace lock', async () => {
  const familyId = randomUUID();
  const tokenDigest = digest();
  await insert(postgres.client, 'refresh_sessions', {
    id: randomUUID(),
    user_id: data.user.id,
    family_id: familyId,
    active_workspace_id: data.b.workspace.id,
    token_digest: tokenDigest,
    expires_at: new Date(Date.now() + 86_400_000),
  });
  await postgres.client.query('BEGIN');
  let pending;
  try {
    await postgres.client.query("SET LOCAL lock_timeout='2s'");
    await postgres.client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [
      data.a.workspace.id,
    ]);
    pending = identities.switchWorkspace(
      { userId: data.user.id, familyId, workspaceId: data.b.workspace.id },
      tokenDigest,
      digest(),
      data.a.workspace.id,
    );
    let blocked = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (
        (
          await postgres.client.query(
            'SELECT 1 FROM pg_locks WHERE granted=false AND pid<>pg_backend_pid()',
          )
        ).rowCount
      ) {
        blocked = true;
        break;
      }

      await setTimeout(10);
    }
    expect(blocked).toBe(true);
    await insert(postgres.client, 'memberships', {
      workspace_id: data.a.workspace.id,
      user_id: data.user.id,
      role: 'member',
    });
    await postgres.client.query('COMMIT');
    const result = await pending;
    expect(result.status).toBe('rotated');
    expect(result.session.activeWorkspace).toMatchObject({
      id: data.a.workspace.id,
      role: 'member',
    });
  } finally {
    await postgres.client.query('ROLLBACK');
    await pending?.catch(() => {});
  }
});

test('member keyset pages keep equal timestamps in stable UUID order', async () => {
  const workspaceId = data.a.workspace.id;
  const createdAt = new Date();
  const ids = [];
  for (let index = 0; index < 3; index += 1) {
    const user = await insert(postgres.client, 'users', {
      id: randomUUID(),
      name: 'Page member',
      email: `page-${index}@example.test`,
      password_hash: 'test-only',
    });
    ids.push(user.id);
    await insert(postgres.client, 'memberships', {
      workspace_id: workspaceId,
      user_id: user.id,
      role: 'member',
      created_at: createdAt,
      updated_at: createdAt,
    });
  }
  const seen = [];
  let after;
  for (let page = 0; page < 10; page += 1) {
    const rows = await database.read({ workspaceId, actorUserId: data.otherUser.id }, (view) =>
      view.memberships.list({ limit: 1, ...(after ? { after } : {}) }),
    );
    if (!rows.length) break;

    seen.push(rows[0].userId);
    if (rows.length === 1) break;

    after = { createdAt: rows[0].createdAt, id: rows[0].userId };
  }
  expect(new Set(seen).size).toBe(seen.length);
  expect(seen.filter((id) => ids.includes(id))).toEqual([...ids].sort());
  expect(seen).not.toContain(data.b.workspace.id);
});
