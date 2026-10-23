import { createHash, randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createIdentityRepository } from '../dist/index.js';

import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let identities;
const account = (email) => ({
  email,
  name: 'Test User',
  password: ' A real password ',
  workspaceName: 'Test workspace',
});
const credential = () => ({
  expiresAt: new Date(Date.now() + 86400_000),
  familyId: randomUUID(),
  tokenDigest: createHash('sha256').update(randomUUID()).digest('hex'),
});
beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  identities = createIdentityRepository(await applicationUrl(postgres));
});
afterAll(async () => {
  await identities?.close();
  await postgres?.client.end();
  postgres?.stop();
});

test('signup persists complete defaults and private credential fields stay behind the boundary', async () => {
  const value = credential();
  const session = await identities.register(account('initial@example.com'), value);
  expect(session.activeWorkspace.role).toBe('admin');
  expect(Object.keys(session.user).sort()).toEqual([
    'createdAt',
    'email',
    'id',
    'name',
    'updatedAt',
  ]);
  expect(
    (
      await postgres.client.query(
        'SELECT category FROM status_identities WHERE workspace_id=$1 ORDER BY category',
        [session.activeWorkspace.id],
      )
    ).rows.map((row) => row.category),
  ).toEqual(['not_started', 'active', 'done']);
  const stored = (
    await postgres.client.query('SELECT token_digest FROM refresh_sessions WHERE family_id=$1', [
      value.familyId,
    ])
  ).rows[0];
  expect(stored.token_digest).toBe(value.tokenDigest);
  const hash = (
    await postgres.client.query('SELECT password_hash FROM users WHERE id=$1', [session.user.id])
  ).rows[0].password_hash;
  expect(hash).toMatch(/^\$argon2id\$/);
  expect(JSON.stringify(session)).not.toMatch(/password|tokenDigest/);
});

test('concurrent normalized-email registration commits exactly one complete account', async () => {
  const before = (await postgres.client.query('SELECT count(*)::int AS n FROM workspaces')).rows[0]
    .n;
  const results = await Promise.allSettled([
    identities.register(account(' Race@Example.com '), credential()),
    identities.register(account('race@example.com'), credential()),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected').reason.code).toBe('EMAIL_IN_USE');
  expect((await postgres.client.query('SELECT count(*)::int AS n FROM workspaces')).rows[0].n).toBe(
    before + 1,
  );
});

test('failure creating defaults rolls back user, workspace and initial session', async () => {
  const before = (await postgres.client.query('SELECT count(*)::int AS n FROM workspaces')).rows[0]
    .n;
  await postgres.client.query(
    "CREATE FUNCTION reject_auth_defaults() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_auth_defaults BEFORE INSERT ON status_overrides FOR EACH ROW EXECUTE FUNCTION reject_auth_defaults()",
  );
  try {
    await expect(
      identities.register(account('rollback@example.com'), credential()),
    ).rejects.toBeDefined();
  } finally {
    await postgres.client.query(
      'DROP TRIGGER reject_auth_defaults ON status_overrides; DROP FUNCTION reject_auth_defaults()',
    );
  }
  expect(
    (
      await postgres.client.query(
        "SELECT count(*)::int AS n FROM users WHERE email='rollback@example.com'",
      )
    ).rows[0].n,
  ).toBe(0);
  expect((await postgres.client.query('SELECT count(*)::int AS n FROM workspaces')).rows[0].n).toBe(
    before,
  );
});

test('authentication binds family, user and workspace and reads current role/membership', async () => {
  const seed = credential();
  const session = await identities.register(account('membership@example.com'), seed);
  const claim = {
    familyId: seed.familyId,
    userId: session.user.id,
    workspaceId: session.activeWorkspace.id,
  };
  expect((await identities.authenticate(claim)).activeWorkspace.role).toBe('admin');
  await postgres.client.query("UPDATE memberships SET role='member' WHERE user_id=$1", [
    session.user.id,
  ]);
  expect((await identities.authenticate(claim)).activeWorkspace.role).toBe('member');
  await expect(identities.authenticate({ ...claim, userId: randomUUID() })).rejects.toMatchObject({
    code: 'UNAUTHENTICATED',
  });
  await expect(
    identities.authenticate({ ...claim, workspaceId: randomUUID() }),
  ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  await postgres.client.query('DELETE FROM memberships WHERE user_id=$1', [session.user.id]);
  await expect(identities.authenticate(claim)).rejects.toMatchObject({
    code: 'MEMBERSHIP_REQUIRED',
  });
  const fresh = await identities.logIn(
    { email: 'membership@example.com', password: ' A real password ' },
    credential(),
  );
  expect(fresh.activeWorkspace).toBeNull();
});

test('wrong and unknown credentials are uniform; password whitespace is significant', async () => {
  for (const input of [
    { email: 'initial@example.com', password: 'A real password' },
    { email: 'absent@example.com', password: ' A real password ' },
  ]) {
    await expect(identities.logIn(input, credential())).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Invalid email or password',
    });
  }
  expect(
    (
      await identities.logIn(
        { email: ' INITIAL@example.com ', password: ' A real password ' },
        credential(),
      )
    ).user.email,
  ).toBe('initial@example.com');
});

test('session uniqueness failures are never misreported as duplicate email', async () => {
  const reused = credential();
  await identities.logIn({ email: 'initial@example.com', password: ' A real password ' }, reused);
  await expect(
    identities.logIn({ email: 'initial@example.com', password: ' A real password ' }, reused),
  ).rejects.not.toMatchObject({ code: 'EMAIL_IN_USE' });
});
