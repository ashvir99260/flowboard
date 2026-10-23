import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import {
  cookieOf,
  AuthTestOrigin as origin,
  SignupFixture,
} from '../../../test/common/auth-fixtures.mjs';

let fixture;
let session;
let bob;
beforeAll(async () => {
  fixture = await startTestApplication({ auth: true });
  const response = await request(fixture.app.getHttpServer())
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send(SignupFixture);
  expect(response.status).toBe(201);
  session = response.body.data;
  const second = await request(fixture.app.getHttpServer())
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({
      ...SignupFixture,
      email: 'bob@example.test',
      name: 'Bob',
      workspaceName: 'Bob workspace',
    });
  expect(second.status).toBe(201);
  bob = second.body.data;
});

test('administrators manage members with revision and last-admin protection', async () => {
  const server = fixture.app.getHttpServer();
  const owner = await request(server)
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...SignupFixture, email: 'owner@example.test' });
  expect(owner.status).toBe(201);
  const session = owner.body.data;
  const path = `/v1/workspaces/${session.activeWorkspace.id}/members`;
  const auth = { Authorization: `Bearer ${session.accessToken}` };
  const created = await request(server)
    .post(path)
    .set(auth)
    .send({ email: ' BOB@example.test ', expectedConfigVersion: 1, role: 'member' });
  expect(created.status).toBe(201);
  expect(created.body.data).toMatchObject({ userId: bob.user.id, role: 'member' });
  expect(created.body.configVersion).toBe(2);
  const duplicate = await request(server)
    .post(path)
    .set(auth)
    .send({ email: bob.user.email, role: 'admin', expectedConfigVersion: 2 });
  expect(duplicate.status).toBe(409);
  expect(duplicate.body.error.code).toBe('MEMBERSHIP_EXISTS');
  const promoted = await request(server)
    .patch(`${path}/${bob.user.id}`)
    .set(auth)
    .send({ expectedConfigVersion: 2, role: 'admin' });
  expect(promoted.status).toBe(200);
  expect(promoted.body.configVersion).toBe(3);
  const unchanged = await request(server)
    .patch(`${path}/${bob.user.id}`)
    .set(auth)
    .send({ expectedConfigVersion: 3, role: 'admin' });
  expect(unchanged.status).toBe(200);
  expect(unchanged.body).toEqual(promoted.body);
  expect(
    (
      await request(server)
        .patch(`${path}/${bob.user.id}`)
        .set(auth)
        .send({ expectedConfigVersion: 2, role: 'member' })
    ).status,
  ).toBe(409);
  const demoted = await request(server)
    .patch(`${path}/${bob.user.id}`)
    .set(auth)
    .send({ expectedConfigVersion: 3, role: 'member' });
  expect(demoted.status).toBe(200);
  const lastAdmin = await request(server)
    .delete(`${path}/${session.user.id}`)
    .set(auth)
    .send({ expectedConfigVersion: 4 });
  expect(lastAdmin.status).toBe(409);
  expect(lastAdmin.body.error.code).toBe('LAST_ADMIN');
  const removed = await request(server)
    .delete(`${path}/${bob.user.id}`)
    .set(auth)
    .send({ expectedConfigVersion: 4 });
  expect(removed.status).toBe(204);
  const page = await request(server).get(path).set(auth);
  expect(page.body.configVersion).toBe(5);
  expect(page.body.items.map(({ userId }) => userId)).toEqual([session.user.id]);
});
afterAll(async () => fixture?.close());

test('current user is a safe authenticated projection', async () => {
  const server = fixture.app.getHttpServer();
  expect((await request(server).get('/v1/me')).status).toBe(401);
  const response = await request(server)
    .get('/v1/me')
    .set('Authorization', `Bearer ${session.accessToken}`);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: { user: session.user, activeWorkspace: session.activeWorkspace },
  });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(JSON.stringify(response.body)).not.toMatch(/password|token|familyId/);
  expect(
    (
      await request(server)
        .get('/v1/me?workspaceId=spoofed')
        .set('Authorization', `Bearer ${session.accessToken}`)
    ).status,
  ).toBe(400);
});

test('workspace and member pages expose only current memberships with bounded cursor queries', async () => {
  const server = fixture.app.getHttpServer();
  const auth = { Authorization: `Bearer ${session.accessToken}` };
  const workspaces = await request(server).get('/v1/workspaces?limit=1').set(auth);
  expect(workspaces.status).toBe(200);
  expect(workspaces.body.items).toEqual([session.activeWorkspace]);
  expect(workspaces.body.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });
  const members = await request(server)
    .get(`/v1/workspaces/${session.activeWorkspace.id}/members?limit=1`)
    .set(auth);
  expect(members.status).toBe(200);
  expect(members.body.configVersion).toBe(1);
  expect(members.body.items).toEqual([
    expect.objectContaining({
      userId: session.user.id,
      email: session.user.email,
      role: 'admin',
      name: session.user.name,
    }),
  ]);
  expect(members.body.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });
  for (const query of ['limit=0', 'limit=101', 'limit=1&limit=2', 'page=1', 'cursor=invalid']) {
    expect((await request(server).get(`/v1/workspaces?${query}`).set(auth)).status).toBe(400);
  }
});

test('invitations and workspace switching keep roles and credentials scoped to the login family', async () => {
  const server = fixture.app.getHttpServer();
  const signup = async (email) =>
    request(server)
      .post('/v1/auth/signup')
      .set('Origin', origin)
      .send({ ...SignupFixture, email });
  const owner = await signup('inviter@example.test');
  const guest = await signup('invitee@example.test');
  expect(owner.status).toBe(201);
  expect(guest.status).toBe(201);
  const ownerAuth = { Authorization: `Bearer ${owner.body.data.accessToken}` };
  const guestAuth = { Authorization: `Bearer ${guest.body.data.accessToken}` };
  const workspaceId = owner.body.data.activeWorkspace.id;
  const invite = await request(server)
    .post(`/v1/workspaces/${workspaceId}/invitations`)
    .set(ownerAuth)
    .send({ email: ' INVITEE@example.test ', expectedConfigVersion: 1, role: 'member' });
  expect(invite.status).toBe(201);
  expect(invite.body.data.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(Date.parse(invite.body.data.expiresAt) - Date.now()).toBeGreaterThan(47 * 3600_000);
  const accepted = await request(server)
    .post('/v1/invitations/accept')
    .set(guestAuth)
    .send({ token: invite.body.data.token });
  expect(accepted.status).toBe(200);
  expect(accepted.body.data).toMatchObject({ id: workspaceId, role: 'member' });
  expect((await request(server).get('/v1/me').set(guestAuth)).body.data.activeWorkspace.id).toBe(
    guest.body.data.activeWorkspace.id,
  );
  const mismatch = await request(server)
    .post('/v1/auth/switch-workspace')
    .set(guestAuth)
    .set('Origin', origin)
    .set('Cookie', cookieOf(owner))
    .send({ workspaceId });
  expect(mismatch.status).toBe(401);
  const switched = await request(server)
    .post('/v1/auth/switch-workspace')
    .set(guestAuth)
    .set('Origin', origin)
    .set('Cookie', cookieOf(guest))
    .send({ workspaceId });
  expect(switched.status).toBe(200);
  expect(switched.body.data.activeWorkspace).toMatchObject({ id: workspaceId, role: 'member' });
  expect(cookieOf(switched)).not.toBe(cookieOf(guest));
  expect((await request(server).get('/v1/me').set(guestAuth)).status).toBe(401);
  const selectedAuth = { Authorization: `Bearer ${switched.body.data.accessToken}` };
  const members = await request(server)
    .get(`/v1/workspaces/${workspaceId}/members`)
    .set(selectedAuth);
  expect(members.status).toBe(200);
  expect(
    members.body.items.find((member) => member.userId === owner.body.data.user.id).email,
  ).toBeUndefined();
  expect(members.body.items.find((member) => member.userId === guest.body.data.user.id).email).toBe(
    'invitee@example.test',
  );
  expect(
    (
      await request(server)
        .post(`/v1/workspaces/${workspaceId}/members`)
        .set(selectedAuth)
        .send({ email: 'bob@example.test', expectedConfigVersion: 3, role: 'admin' })
    ).status,
  ).toBe(403);
  const replay = await request(server)
    .post('/v1/invitations/accept')
    .set(selectedAuth)
    .send({ token: invite.body.data.token });
  expect(replay.status).toBe(409);
  expect(replay.body.error.code).toBe('INVITATION_UNAVAILABLE');
  const promoted = await request(server)
    .patch(`/v1/workspaces/${workspaceId}/members/${guest.body.data.user.id}`)
    .set(ownerAuth)
    .send({ expectedConfigVersion: 3, role: 'admin' });
  expect(promoted.status).toBe(200);
  expect(
    (await request(server).get('/v1/me').set(selectedAuth)).body.data.activeWorkspace.role,
  ).toBe('admin');
  const removed = await request(server)
    .delete(`/v1/workspaces/${workspaceId}/members/${guest.body.data.user.id}`)
    .set(ownerAuth)
    .send({ expectedConfigVersion: 4 });
  expect(removed.status).toBe(204);
  expect(
    (await request(server).get('/v1/me').set(selectedAuth)).body.data.activeWorkspace,
  ).toBeNull();
  expect(
    (await request(server).get(`/v1/workspaces/${workspaceId}/members`).set(selectedAuth)).status,
  ).toBe(403);
  expect(
    (
      await request(server)
        .post('/v1/auth/refresh')
        .set('Origin', origin)
        .set('Cookie', cookieOf(switched))
        .send({})
    ).status,
  ).toBe(403);
  const recovered = await request(server)
    .post('/v1/auth/switch-workspace')
    .set(selectedAuth)
    .set('Origin', origin)
    .set('Cookie', cookieOf(switched))
    .send({ workspaceId: guest.body.data.activeWorkspace.id });
  expect(recovered.status).toBe(200);
  expect(recovered.body.data.activeWorkspace.id).toBe(guest.body.data.activeWorkspace.id);
});

test('cursor pages are bound to caller, limit and membership revision without leaking emails', async () => {
  const server = fixture.app.getHttpServer();
  const owner = await request(server)
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...SignupFixture, email: 'paging@example.test' });
  const identity = owner.body.data;
  const auth = { Authorization: `Bearer ${identity.accessToken}` };
  const path = `/v1/workspaces/${identity.activeWorkspace.id}/members`;
  expect(
    (
      await request(server)
        .post(path)
        .set(auth)
        .send({ email: bob.user.email, role: 'member', expectedConfigVersion: 1 })
    ).status,
  ).toBe(201);
  const first = await request(server).get(`${path}?limit=1`).set(auth);
  expect(first.status).toBe(200);
  expect(first.body.items).toHaveLength(1);
  expect(first.body.pageInfo.hasNextPage).toBe(true);
  const cursor = first.body.pageInfo.nextCursor;
  const next = await request(server)
    .get(`${path}?limit=1&cursor=${encodeURIComponent(cursor)}`)
    .set(auth);
  expect(next.status).toBe(200);
  expect(next.body.items).toHaveLength(1);
  expect(next.body.items[0].userId).not.toBe(first.body.items[0].userId);
  expect(next.body.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });
  for (const query of [
    `limit=2&cursor=${cursor}`,
    `limit=1&cursor=x${cursor}`,
    'offset=1',
    'limit=1&limit=2',
    'assignableToListId=unsupported',
  ]) {
    expect((await request(server).get(`${path}?${query}`).set(auth)).status).toBe(400);
  }
  expect(
    (await request(server).get(`/v1/workspaces?limit=1&cursor=${cursor}`).set(auth)).status,
  ).toBe(400);
  expect(
    (
      await request(server)
        .get(path.replace(identity.activeWorkspace.id, identity.activeWorkspace.id.toUpperCase()))
        .set(auth)
    ).status,
  ).toBe(200);
  expect(
    (await request(server).get(path).set('Authorization', `Bearer ${bob.accessToken}`)).status,
  ).toBe(404);
  expect(
    (await request(server).get(path.replace(identity.activeWorkspace.id, 'invalid')).set(auth))
      .status,
  ).toBe(400);
  const changed = await request(server)
    .patch(`${path}/${bob.user.id}`)
    .set(auth)
    .send({ expectedConfigVersion: 2, role: 'admin' });
  expect(changed.status).toBe(200);
  const stale = await request(server).get(`${path}?limit=1&cursor=${cursor}`).set(auth);
  expect(stale.status).toBe(409);
  expect(stale.body.error.code).toBe('CURSOR_STALE');
});

test('unavailable invitations do not change membership or let an existing member upgrade', async () => {
  const server = fixture.app.getHttpServer();
  const owner = await request(server)
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...SignupFixture, email: 'wrong-inviter@example.test' });
  const ownerAuth = { Authorization: `Bearer ${owner.body.data.accessToken}` };
  const invite = await request(server)
    .post(`/v1/workspaces/${owner.body.data.activeWorkspace.id}/invitations`)
    .set(ownerAuth)
    .send({ email: 'different@example.test', expectedConfigVersion: 1, role: 'admin' });
  expect(invite.status).toBe(201);
  for (const token of [invite.body.data.token, 'A'.repeat(43)]) {
    const failed = await request(server)
      .post('/v1/invitations/accept')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ token });
    expect(failed.status).toBe(409);
    expect(failed.body.error.code).toBe('INVITATION_UNAVAILABLE');
  }
  const invalid = await request(server)
    .post('/v1/invitations/accept')
    .set(ownerAuth)
    .send({ token: invite.body.data.token, role: 'admin' });
  expect(invalid.status).toBe(400);
  const missingUser = await request(server)
    .post(`/v1/workspaces/${owner.body.data.activeWorkspace.id}/members`)
    .set(ownerAuth)
    .send({ email: 'unknown@example.test', expectedConfigVersion: 2, role: 'member' });
  expect(missingUser.status).toBe(404);
  const path = `/v1/workspaces/${owner.body.data.activeWorkspace.id}`;
  expect(
    (
      await request(server)
        .post(`${path}/members`)
        .set(ownerAuth)
        .send({ email: bob.user.email, role: 'member', expectedConfigVersion: 2 })
    ).status,
  ).toBe(201);
  const upgrade = await request(server)
    .post(`${path}/invitations`)
    .set(ownerAuth)
    .send({ email: bob.user.email, role: 'admin', expectedConfigVersion: 3 });
  expect(upgrade.status).toBe(201);
  expect(
    (
      await request(server)
        .post('/v1/invitations/accept')
        .set('Authorization', `Bearer ${bob.accessToken}`)
        .send({ token: upgrade.body.data.token })
    ).status,
  ).toBe(409);
  const finalMembers = await request(server).get(`${path}/members`).set(ownerAuth);
  expect(finalMembers.body.items.find(({ userId }) => userId === bob.user.id).role).toBe('member');
});

test('concurrent administrator demotions leave one administrator and recheck the current revision', async () => {
  const server = fixture.app.getHttpServer();
  const makeUser = async (email) =>
    request(server)
      .post('/v1/auth/signup')
      .set('Origin', origin)
      .send({ ...SignupFixture, email });
  const one = await makeUser('race-one@example.test');
  const two = await makeUser('race-two@example.test');
  const workspaceId = one.body.data.activeWorkspace.id;
  const path = `/v1/workspaces/${workspaceId}/members`;
  const oneAuth = { Authorization: `Bearer ${one.body.data.accessToken}` };
  expect(
    (
      await request(server)
        .post(path)
        .set(oneAuth)
        .send({ email: two.body.data.user.email, role: 'admin', expectedConfigVersion: 1 })
    ).status,
  ).toBe(201);
  const selected = await request(server)
    .post('/v1/auth/switch-workspace')
    .set('Authorization', `Bearer ${two.body.data.accessToken}`)
    .set('Cookie', cookieOf(two))
    .set('Origin', origin)
    .send({ workspaceId });
  expect(selected.status).toBe(200);
  const twoAuth = { Authorization: `Bearer ${selected.body.data.accessToken}` };
  const results = await Promise.all([
    request(server)
      .patch(`${path}/${one.body.data.user.id}`)
      .set(oneAuth)
      .send({ expectedConfigVersion: 2, role: 'member' }),
    request(server)
      .patch(`${path}/${two.body.data.user.id}`)
      .set(twoAuth)
      .send({ expectedConfigVersion: 2, role: 'member' }),
  ]);
  expect(results.map(({ status }) => status).sort()).toEqual([200, 409]);
  const page = await request(server).get(path).set(oneAuth);
  const admins = page.body.items.filter(({ role }) => role === 'admin');
  expect(admins).toHaveLength(1);
  const lastAuth = admins[0].userId === one.body.data.user.id ? oneAuth : twoAuth;
  const last = await request(server)
    .delete(`${path}/${admins[0].userId}`)
    .set(lastAuth)
    .send({ expectedConfigVersion: 3 });
  expect(last.status).toBe(409);
  expect(last.body.error.code).toBe('LAST_ADMIN');
});

test('all new operations require identity and reject body authority injection', async () => {
  const server = fixture.app.getHttpServer();
  const path = `/v1/workspaces/${session.activeWorkspace.id}`;
  for (const [method, url] of [
    ['get', '/v1/workspaces'],
    ['get', `${path}/members`],
    ['post', `${path}/members`],
    ['patch', `${path}/members/${bob.user.id}`],
    ['delete', `${path}/members/${bob.user.id}`],
    ['post', `${path}/invitations`],
    ['post', '/v1/invitations/accept'],
    ['post', '/v1/auth/switch-workspace'],
  ]) {
    expect((await request(server)[method](url).set('Origin', origin)).status).toBe(401);
  }
  const auth = { Authorization: `Bearer ${session.accessToken}` };
  for (const input of [
    { email: bob.user.email, role: 'owner', expectedConfigVersion: 1 },
    { email: bob.user.email, role: 'member' },
    { email: bob.user.email, role: 'member', expectedConfigVersion: '1' },
    {
      email: bob.user.email,
      role: 'member',
      expectedConfigVersion: 1,
      actorUserId: session.user.id,
    },
    {
      email: bob.user.email,
      role: 'member',
      expectedConfigVersion: 1,
      workspaceId: bob.activeWorkspace.id,
    },
    {
      email: bob.user.email,
      role: 'member',
      expectedConfigVersion: 1,
      createdAt: new Date().toISOString(),
    },
  ]) {
    expect((await request(server).post(`${path}/members`).set(auth).send(input)).status).toBe(400);
  }
});

test('switch rejects another login family and a foreign destination without consuming cookies', async () => {
  const server = fixture.app.getHttpServer();
  const first = await request(server)
    .post('/v1/auth/login')
    .set('Origin', origin)
    .send({ email: bob.user.email, password: SignupFixture.password });
  const second = await request(server)
    .post('/v1/auth/login')
    .set('Origin', origin)
    .send({ email: bob.user.email, password: SignupFixture.password });
  const auth = { Authorization: `Bearer ${first.body.data.accessToken}` };
  const path = '/v1/auth/switch-workspace';
  expect(
    (
      await request(server)
        .post(path)
        .set(auth)
        .set('Origin', origin)
        .set('Cookie', cookieOf(second))
        .send({ workspaceId: bob.activeWorkspace.id })
    ).status,
  ).toBe(401);
  expect(
    (
      await request(server)
        .post('/v1/auth/refresh')
        .set('Origin', origin)
        .set('Cookie', cookieOf(second))
        .send({})
    ).status,
  ).toBe(200);
  expect(
    (
      await request(server)
        .post(path)
        .set(auth)
        .set('Origin', 'https://evil.example')
        .set('Cookie', cookieOf(first))
        .send({ workspaceId: bob.activeWorkspace.id })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(server)
        .post(path)
        .set(auth)
        .set('Origin', origin)
        .set('Cookie', cookieOf(first))
        .send({ workspaceId: session.activeWorkspace.id })
    ).status,
  ).toBe(404);
  expect(
    (
      await request(server)
        .post('/v1/auth/refresh')
        .set('Origin', origin)
        .set('Cookie', cookieOf(first))
        .send({})
    ).status,
  ).toBe(200);
});
