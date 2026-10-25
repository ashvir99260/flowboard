import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createDatabase, createIdentityRepository } from '../dist/index.js';

import { fixtures, insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let database;
let identities;
let data;
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

async function scenario() {
  const user = await insert(postgres.client, 'users', {
    id: randomUUID(),
    email: `${randomUUID()}@example.test`,
    name: 'Owner',
    password_hash: 'test-only-hash',
  });
  const workspace = await insert(postgres.client, 'workspaces', {
    id: randomUUID(),
    name: 'Lifecycle',
  });
  await insert(postgres.client, 'memberships', {
    user_id: user.id,
    workspace_id: workspace.id,
    role: 'admin',
  });
  const session = await insert(postgres.client, 'refresh_sessions', {
    id: randomUUID(),
    user_id: user.id,
    active_workspace_id: workspace.id,
    family_id: randomUUID(),
    token_digest: randomUUID().replaceAll('-', '').repeat(2),
    expires_at: new Date(Date.now() + 60_000),
  });

  return {
    context: { actorUserId: user.id, workspaceId: workspace.id },
    identity: { userId: user.id, workspaceId: workspace.id, familyId: session.family_id },
    session,
    workspace,
  };
}

async function waitForLock(pending) {
  for (let attempt = 0; attempt < 150; attempt++) {
    await postgres.client.query('SELECT pg_stat_clear_snapshot()');
    const { rows } = await postgres.client.query(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%SELECT id FROM workspaces%'",
    );
    if (rows[0].n > 0) return;

    await setTimeout(10);
  }
  await postgres.client.query('ROLLBACK');
  await pending;
  throw new Error('Expected workspace lock wait');
}

test('rename is versioned, no-op safe and a failed outbox insertion rolls back the root', async () => {
  const { context } = await scenario();
  const original = await database.read(context, (view) => view.workspace.snapshot());
  const renamed = await database.write(context, (store) =>
    store.workspace.rename({ expectedConfigVersion: 1, name: ' Updated ' }),
  );
  expect(renamed).toMatchObject({
    data: { archivedAt: null, name: 'Updated' },
    configVersion: 2,
    dataVersion: 1,
  });
  expect(
    await database.write(context, (store) =>
      store.workspace.rename({ expectedConfigVersion: 2, name: 'Updated' }),
    ),
  ).toEqual(renamed);
  await expect(
    database.write(context, (store) =>
      store.workspace.rename({ expectedConfigVersion: 1, name: 'Stale' }),
    ),
  ).rejects.toMatchObject({ code: 'CONFIG_CONFLICT' });
  // The interpolated ID is generated only by this isolated fixture.
  await postgres.client.query(
    `CREATE FUNCTION reject_lifecycle_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.workspace_id='${context.workspaceId}'::uuid THEN RAISE EXCEPTION 'fixture outbox failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_lifecycle_event BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_lifecycle_event()`,
  );
  try {
    await expect(
      database.write(context, (store) => store.workspace.archive({ expectedConfigVersion: 2 })),
    ).rejects.toBeDefined();
    expect(await database.read(context, (view) => view.workspace.snapshot())).toEqual(renamed);
  } finally {
    await postgres.client.query(
      'DROP TRIGGER reject_lifecycle_event ON outbox_events; DROP FUNCTION reject_lifecycle_event()',
    );
  }
  expect(renamed.data.createdAt).toBe(original.data.createdAt);
});

test('archive gates direct tenant and identity access; restore preserves descendant flags and history', async () => {
  const context = { actorUserId: data.user.id, workspaceId: data.a.workspace.id };
  const identity = {
    userId: data.user.id,
    workspaceId: data.a.workspace.id,
    familyId: data.session.family_id,
  };
  await postgres.client.query('UPDATE tasks SET archived_at=clock_timestamp() WHERE id=$1', [
    data.a.task.id,
  ]);
  const before = (
    await postgres.client.query('SELECT * FROM tasks WHERE workspace_id=$1', [context.workspaceId])
  ).rows;
  const archived = await database.write(context, (store) =>
    store.workspace.archive({ expectedConfigVersion: 1 }),
  );
  expect(archived).toMatchObject({ configVersion: 2, dataVersion: 2 });
  expect(archived.data.archivedAt).toEqual(expect.any(String));
  await expect(
    database.read(context, (view) => view.nodes.find(data.a.list.id)),
  ).rejects.toMatchObject({ code: 'WORKSPACE_ARCHIVED' });
  await expect(
    database.write(context, (store) => store.nodes.rename(data.a.list.id, 'Hidden write')),
  ).rejects.toMatchObject({ code: 'WORKSPACE_ARCHIVED' });
  await expect(identities.authenticate(identity)).rejects.toMatchObject({
    code: 'WORKSPACE_ARCHIVED',
  });
  expect((await identities.authenticate(identity, true)).activeWorkspace.id).toBe(
    context.workspaceId,
  );
  await expect(
    identities.restoreWorkspace(identity, context.workspaceId, { expectedConfigVersion: 1 }),
  ).rejects.toMatchObject({ code: 'CONFIG_CONFLICT' });
  const restored = await identities.restoreWorkspace(identity, context.workspaceId, {
    expectedConfigVersion: 2,
  });
  expect(restored).toMatchObject({ data: { archivedAt: null }, configVersion: 3, dataVersion: 3 });
  expect(
    await identities.restoreWorkspace(identity, context.workspaceId, { expectedConfigVersion: 3 }),
  ).toEqual(restored);
  expect(
    (
      await postgres.client.query('SELECT * FROM tasks WHERE workspace_id=$1', [
        context.workspaceId,
      ])
    ).rows,
  ).toEqual(before);
  expect(
    (
      await postgres.client.query(
        'SELECT count(*)::int AS n FROM activities WHERE workspace_id=$1',
        [context.workspaceId],
      )
    ).rows[0].n,
  ).toBe(1);
});

test('restore rechecks target membership and rejects foreign, removed and demoted administrators', async () => {
  const { context, identity } = await scenario();
  await database.write(context, (store) => store.workspace.archive({ expectedConfigVersion: 1 }));
  await expect(
    identities.restoreWorkspace(identity, data.a.workspace.id, { expectedConfigVersion: 1 }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await postgres.client.query("UPDATE memberships SET role='member' WHERE workspace_id=$1", [
    context.workspaceId,
  ]);
  await expect(
    identities.authorizeWorkspaceRestore(identity, context.workspaceId),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  await expect(
    identities.restoreWorkspace(identity, context.workspaceId, { expectedConfigVersion: 2 }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  expect((await identities.listWorkspaces(identity.userId, { limit: 10 })).length).toBe(0);
  await postgres.client.query('DELETE FROM memberships WHERE workspace_id=$1', [
    context.workspaceId,
  ]);
  await expect(
    identities.restoreWorkspace(identity, context.workspaceId, { expectedConfigVersion: 2 }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('archive wins over a tenant write waiting on the workspace lock', async () => {
  const { context } = await scenario();
  await postgres.client.query('BEGIN');
  await postgres.client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [
    context.workspaceId,
  ]);
  const pending = database
    .write(context, (store) =>
      store.workspace.rename({ expectedConfigVersion: 1, name: 'Too late' }),
    )
    .catch((error) => error);
  await waitForLock(pending);
  await postgres.client.query('UPDATE workspaces SET archived_at=clock_timestamp() WHERE id=$1', [
    context.workspaceId,
  ]);
  await postgres.client.query('COMMIT');
  expect(await pending).toMatchObject({ code: 'WORKSPACE_ARCHIVED' });
  expect(
    (await postgres.client.query('SELECT name FROM workspaces WHERE id=$1', [context.workspaceId]))
      .rows[0].name,
  ).toBe('Lifecycle');
});

test.each(['logout', 'switch', 'demotion', 'expiry'])(
  'restore waiting on a workspace lock rechecks %s',
  async (change) => {
    const { context, identity, session } = await scenario();
    await database.write(context, (store) => store.workspace.archive({ expectedConfigVersion: 1 }));
    await postgres.client.query('BEGIN');
    await postgres.client.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE', [
      context.workspaceId,
    ]);
    const pending = identities
      .restoreWorkspace(identity, context.workspaceId, { expectedConfigVersion: 2 })
      .catch((error) => error);
    await waitForLock(pending);
    if (change === 'demotion')
      await postgres.client.query("UPDATE memberships SET role='member' WHERE workspace_id=$1", [
        context.workspaceId,
      ]);
    else if (change === 'expiry')
      await postgres.client.query(
        "UPDATE refresh_sessions SET expires_at=clock_timestamp()-interval '1 millisecond' WHERE id=$1",
        [session.id],
      );
    else if (change === 'logout')
      await postgres.client.query(
        'UPDATE refresh_sessions SET revoked_at=clock_timestamp() WHERE id=$1',
        [session.id],
      );
    else
      await postgres.client.query(
        'UPDATE refresh_sessions SET active_workspace_id=NULL WHERE id=$1',
        [session.id],
      );

    await postgres.client.query('COMMIT');
    expect(await pending).toMatchObject({
      code: change === 'demotion' ? 'FORBIDDEN' : 'UNAUTHENTICATED',
    });
    const result = (
      await postgres.client.query('SELECT archived_at,config_version FROM workspaces WHERE id=$1', [
        context.workspaceId,
      ])
    ).rows[0];
    expect(result.archived_at).not.toBeNull();
    expect(result.config_version).toBe(2);
  },
);

test('workspace cursor pages filter archived non-admin memberships before pagination', async () => {
  const { identity } = await scenario();
  const baseline = (
    await postgres.client.query(
      'SELECT created_at FROM memberships WHERE workspace_id=$1 AND user_id=$2',
      [identity.workspaceId, identity.userId],
    )
  ).rows[0].created_at.getTime();
  let sequence = 0;
  const add = async (name, role, archived) => {
    const workspace = await insert(postgres.client, 'workspaces', {
      id: randomUUID(),
      name,
      archived_at: null,
    });
    await insert(postgres.client, 'memberships', {
      user_id: identity.userId,
      workspace_id: workspace.id,
      role,
      created_at: new Date(baseline + ++sequence * 1000),
    });
    if (archived)
      await postgres.client.query(
        'UPDATE workspaces SET archived_at=clock_timestamp() WHERE id=$1',
        [workspace.id],
      );

    return workspace.id;
  };
  const hidden = await add('Hidden member', 'member', true);
  const visible = await add('Live member', 'member', false);
  const recovery = await add('Archived admin', 'admin', true);
  const first = await identities.listWorkspaces(identity.userId, { limit: 1 });
  const ids = [first[0].workspace.id];
  let last = first[0];
  for (let n = 0; n < 4; n++) {
    const rows = await identities.listWorkspaces(identity.userId, {
      limit: 1,
      after: { createdAt: last.membershipCreatedAt, id: last.workspace.id },
    });
    if (!rows.length) break;

    ids.push(rows[0].workspace.id);
    last = rows[0];
  }
  expect(ids).toEqual([identity.workspaceId, visible, recovery]);
  expect(ids).not.toContain(hidden);
});

test('restore rolls back root state and revisions if outbox insertion fails', async () => {
  const { context, identity } = await scenario();
  const archived = await database.write(context, (store) =>
    store.workspace.archive({ expectedConfigVersion: 1 }),
  );
  const before = (
    await postgres.client.query('SELECT * FROM workspaces WHERE id=$1', [context.workspaceId])
  ).rows;
  const count = async () =>
    (
      await postgres.client.query(
        'SELECT count(*)::int AS n FROM outbox_events WHERE workspace_id=$1',
        [context.workspaceId],
      )
    ).rows[0].n;
  const events = await count();
  // The interpolated ID is generated only by this isolated fixture.
  await postgres.client.query(
    `CREATE FUNCTION reject_recovery_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.workspace_id='${context.workspaceId}'::uuid THEN RAISE EXCEPTION 'fixture recovery failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_recovery_event BEFORE INSERT ON outbox_events FOR EACH ROW EXECUTE FUNCTION reject_recovery_event()`,
  );
  try {
    await expect(
      identities.restoreWorkspace(identity, context.workspaceId, {
        expectedConfigVersion: archived.configVersion,
      }),
    ).rejects.toBeDefined();
    expect(
      (await postgres.client.query('SELECT * FROM workspaces WHERE id=$1', [context.workspaceId]))
        .rows,
    ).toEqual(before);
    expect(await count()).toBe(events);
  } finally {
    await postgres.client.query(
      'DROP TRIGGER reject_recovery_event ON outbox_events; DROP FUNCTION reject_recovery_event()',
    );
  }
});
