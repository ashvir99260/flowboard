import { createHash, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createIdentityRepository } from '../dist/index.js';

import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let identities;
const digest = () => createHash('sha256').update(randomUUID()).digest('hex');
let counter = 0;
async function fresh(expiresAt = new Date(Date.now() + 86400_000)) {
  const credential = { expiresAt, familyId: randomUUID(), tokenDigest: digest() };
  const session = await identities.register(
    {
      email: `refresh-${++counter}@example.com`,
      name: 'User',
      password: 'Refresh password!',
      workspaceName: 'Workspace',
    },
    credential,
  );
  return {
    credential,
    session,
    claims: {
      familyId: credential.familyId,
      userId: session.user.id,
      workspaceId: session.activeWorkspace.id,
    },
  };
}
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

test('rotation persists lineage and preserves family expiry; old access identity remains valid', async () => {
  const initial = await fresh();
  const replacement = digest();
  const rotated = await identities.rotate(initial.credential.tokenDigest, replacement);
  expect(rotated.status).toBe('rotated');
  expect(rotated.session.familyId).toBe(initial.credential.familyId);
  expect(rotated.session.expiresAt).toEqual(initial.credential.expiresAt);
  await expect(identities.authenticate(initial.claims)).resolves.toBeDefined();
  const rows = (
    await postgres.client.query(
      'SELECT * FROM refresh_sessions WHERE family_id=$1 ORDER BY created_at,id',
      [initial.credential.familyId],
    )
  ).rows;
  const old = rows.find((row) => row.token_digest === initial.credential.tokenDigest);
  const next = rows.find((row) => row.token_digest === replacement);
  expect(old.used_at).not.toBeNull();
  expect(old.replaced_by_id).toBe(next.id);
  expect(next.used_at).toBeNull();
  expect(next.expires_at).toEqual(old.expires_at);
});

test('replay commits whole-family revocation and blocks all later access', async () => {
  const initial = await fresh();
  await identities.rotate(initial.credential.tokenDigest, digest());
  expect(await identities.rotate(initial.credential.tokenDigest, digest())).toEqual({
    status: 'reused',
  });
  const rows = (
    await postgres.client.query('SELECT revoked_at FROM refresh_sessions WHERE family_id=$1', [
      initial.credential.familyId,
    ])
  ).rows;
  expect(rows).toHaveLength(2);
  expect(rows.every((row) => row.revoked_at instanceof Date)).toBe(true);
  await expect(identities.authenticate(initial.claims)).rejects.toMatchObject({
    code: 'UNAUTHENTICATED',
  });
});

test('concurrent rotation serializes and replay leaves no active credential', async () => {
  const initial = await fresh();
  const results = await Promise.all([
    identities.rotate(initial.credential.tokenDigest, digest()),
    identities.rotate(initial.credential.tokenDigest, digest()),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual(['reused', 'rotated']);
  expect(
    (
      await postgres.client.query(
        'SELECT count(*)::int AS n FROM refresh_sessions WHERE family_id=$1 AND used_at IS NULL AND revoked_at IS NULL',
        [initial.credential.familyId],
      )
    ).rows[0].n,
  ).toBe(0);
});

test('failed replacement rolls back consumption and can be retried', async () => {
  const initial = await fresh();
  await postgres.client.query(
    "CREATE FUNCTION reject_refresh() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$; CREATE TRIGGER reject_refresh BEFORE INSERT ON refresh_sessions FOR EACH ROW EXECUTE FUNCTION reject_refresh()",
  );
  try {
    await expect(identities.rotate(initial.credential.tokenDigest, digest())).rejects.toBeDefined();
  } finally {
    await postgres.client.query(
      'DROP TRIGGER reject_refresh ON refresh_sessions; DROP FUNCTION reject_refresh()',
    );
  }
  const row = (
    await postgres.client.query(
      'SELECT used_at,replaced_by_id FROM refresh_sessions WHERE token_digest=$1',
      [initial.credential.tokenDigest],
    )
  ).rows[0];
  expect(row).toEqual({ replaced_by_id: null, used_at: null });
  expect((await identities.rotate(initial.credential.tokenDigest, digest())).status).toBe(
    'rotated',
  );
});

test('removed membership blocks refresh without consuming its credential', async () => {
  const initial = await fresh();
  await postgres.client.query('DELETE FROM memberships WHERE user_id=$1', [
    initial.session.user.id,
  ]);
  await expect(identities.rotate(initial.credential.tokenDigest, digest())).rejects.toMatchObject({
    code: 'MEMBERSHIP_REQUIRED',
  });
  expect(
    (
      await postgres.client.query('SELECT used_at FROM refresh_sessions WHERE token_digest=$1', [
        initial.credential.tokenDigest,
      ])
    ).rows[0].used_at,
  ).toBeNull();
});

test('expiry and revocation cannot be extended; missing logout remains idempotent', async () => {
  const expired = await fresh();
  const deadline = (
    await postgres.client.query(
      "UPDATE refresh_sessions SET expires_at=clock_timestamp() + interval '1 second' WHERE token_digest=$1 RETURNING expires_at AS deadline",
      [expired.credential.tokenDigest],
    )
  ).rows[0].deadline;
  await setTimeout(Math.max(1, deadline.getTime() - Date.now() + 50));
  expect(await identities.rotate(expired.credential.tokenDigest, digest())).toEqual({
    status: 'invalid',
  });
  const initial = await fresh();
  await identities.revoke(initial.credential.tokenDigest);
  await identities.revoke(initial.credential.tokenDigest);
  await identities.revoke(digest());
  expect(await identities.rotate(initial.credential.tokenDigest, digest())).toEqual({
    status: 'invalid',
  });
});
