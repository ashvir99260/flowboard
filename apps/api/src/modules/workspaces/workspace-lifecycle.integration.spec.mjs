import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import {
  cookieOf,
  AuthTestOrigin as origin,
  SignupFixture,
} from '../../../test/common/auth-fixtures.mjs';

let fixture;
beforeAll(async () => {
  fixture = await startTestApplication({ auth: true });
});
afterAll(async () => fixture?.close());

test('a sole-workspace administrator can archive, refresh, restore and reopen without losing identity', async () => {
  const server = fixture.app.getHttpServer();
  const signup = await request(server)
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({
      ...SignupFixture,
      email: 'lifecycle@example.test',
    });
  expect(signup.status).toBe(201);
  const session = signup.body.data;
  const path = `/v1/workspaces/${session.activeWorkspace.id}`;
  const auth = { Authorization: `Bearer ${session.accessToken}` };
  const archived = await request(server)
    .post(`${path}/archive`)
    .set(auth)
    .send({ expectedConfigVersion: 1 });
  expect(archived.status).toBe(200);
  expect(archived.body.data.archivedAt).toEqual(expect.any(String));
  expect(archived.body.configVersion).toBe(2);
  expect((await request(server).get(path).set(auth)).body.error.code).toBe('WORKSPACE_ARCHIVED');
  const refresh = await request(server)
    .post('/v1/auth/refresh')
    .set('Origin', origin)
    .set('Cookie', cookieOf(signup));
  expect(refresh.status).toBe(200);
  expect(refresh.body.data.activeWorkspace.id).toBe(session.activeWorkspace.id);
  expect(refresh.body.data.activeWorkspace.archivedAt).toBe(archived.body.data.archivedAt);
  const recoveredAuth = { Authorization: `Bearer ${refresh.body.data.accessToken}` };
  const page = await request(server).get('/v1/workspaces').set(recoveredAuth);
  expect(page.status).toBe(200);
  expect(page.body.items).toEqual([
    expect.objectContaining({
      id: session.activeWorkspace.id,
      archivedAt: archived.body.data.archivedAt,
      configVersion: 2,
    }),
  ]);
  const restored = await request(server)
    .post(`${path}/restore`)
    .set(recoveredAuth)
    .send({ expectedConfigVersion: 2 });
  expect(restored.status).toBe(200);
  expect(restored.body.data.archivedAt).toBeNull();
  expect(restored.body.configVersion).toBe(3);
  expect((await request(server).get(path).set(recoveredAuth)).status).toBe(200);
});

test('workspace reads and renames validate access, body ownership and optimistic revisions', async () => {
  const server = fixture.app.getHttpServer();
  const owner = await request(server)
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...SignupFixture, email: 'rename@example.test' });
  const outsider = await request(server)
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...SignupFixture, email: 'outsider@example.test' });
  const path = `/v1/workspaces/${owner.body.data.activeWorkspace.id}`;
  const auth = { Authorization: `Bearer ${owner.body.data.accessToken}` };
  expect((await request(server).get(path)).status).toBe(401);
  expect(
    (
      await request(server)
        .get(path)
        .set('Authorization', `Bearer ${outsider.body.data.accessToken}`)
    ).status,
  ).toBe(404);
  const renamed = await request(server)
    .patch(path)
    .set(auth)
    .send({ expectedConfigVersion: 1, name: ' Engineering ' });
  expect(renamed.status).toBe(200);
  expect(renamed.body).toMatchObject({
    data: { archivedAt: null, name: 'Engineering' },
    configVersion: 2,
    dataVersion: 1,
  });
  expect(
    (
      await request(server)
        .patch(path)
        .set(auth)
        .send({ expectedConfigVersion: 2, name: 'Engineering' })
    ).body,
  ).toEqual(renamed.body);
  expect(
    (await request(server).patch(path).set(auth).send({ expectedConfigVersion: 1, name: 'Stale' }))
      .status,
  ).toBe(409);
  for (const input of [
    { expectedConfigVersion: 2, name: '' },
    { expectedConfigVersion: 2, name: 'Spoof', role: 'admin' },
    { archivedAt: null, expectedConfigVersion: 2, name: 'Spoof' },
    { name: 'No revision' },
  ]) {
    expect((await request(server).patch(path).set(auth).send(input)).status).toBe(400);
  }
  expect((await request(server).get(`${path}?extra=1`).set(auth)).status).toBe(400);
  expect((await request(server).get(path).set(auth)).body).toEqual(renamed.body);
});

test('a fresh login with only an archived membership can restore before explicitly selecting it', async () => {
  const server = fixture.app.getHttpServer();
  const account = { ...SignupFixture, email: 'fresh-recovery@example.test' };
  const signup = await request(server).post('/v1/auth/signup').set('Origin', origin).send(account);
  const session = signup.body.data;
  const path = `/v1/workspaces/${session.activeWorkspace.id}`;
  const auth = { Authorization: `Bearer ${session.accessToken}` };
  expect(
    (await request(server).post(`${path}/archive`).set(auth).send({ expectedConfigVersion: 1 }))
      .status,
  ).toBe(200);
  const login = await request(server)
    .post('/v1/auth/login')
    .set('Origin', origin)
    .send({ email: account.email, password: account.password });
  expect(login.status).toBe(200);
  expect(login.body.data.activeWorkspace).toBeNull();
  const freshAuth = { Authorization: `Bearer ${login.body.data.accessToken}` };
  expect(
    (
      await request(server)
        .post('/v1/auth/switch-workspace')
        .set(freshAuth)
        .set('Origin', origin)
        .set('Cookie', cookieOf(login))
        .send({ workspaceId: session.activeWorkspace.id })
    ).body.error.code,
  ).toBe('WORKSPACE_ARCHIVED');
  expect(
    (
      await request(server)
        .post(`${path}/restore`)
        .set(freshAuth)
        .send({ expectedConfigVersion: 2 })
    ).status,
  ).toBe(200);
  expect((await request(server).get('/v1/me').set(freshAuth)).body.data.activeWorkspace).toBeNull();
  const switched = await request(server)
    .post('/v1/auth/switch-workspace')
    .set(freshAuth)
    .set('Origin', origin)
    .set('Cookie', cookieOf(login))
    .send({ workspaceId: session.activeWorkspace.id });
  expect(switched.status).toBe(200);
  expect(switched.body.data.activeWorkspace).toMatchObject({
    id: session.activeWorkspace.id,
    archivedAt: null,
  });
});

test('members cannot rename/archive/restore; archived memberships disappear and invitations stop working', async () => {
  const server = fixture.app.getHttpServer();
  const owner = await request(server)
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...SignupFixture, email: 'permission-owner@example.test' });
  const member = await request(server)
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...SignupFixture, email: 'permission-member@example.test' });
  const invitee = await request(server)
    .post('/v1/auth/signup')
    .set('Origin', origin)
    .send({ ...SignupFixture, email: 'permission-invitee@example.test' });
  const id = owner.body.data.activeWorkspace.id;
  const path = `/v1/workspaces/${id}`;
  const auth = { Authorization: `Bearer ${owner.body.data.accessToken}` };
  expect(
    (
      await request(server)
        .post(`${path}/members`)
        .set(auth)
        .send({ email: member.body.data.user.email, role: 'member', expectedConfigVersion: 1 })
    ).status,
  ).toBe(201);
  const invitation = await request(server)
    .post(`${path}/invitations`)
    .set(auth)
    .send({ email: invitee.body.data.user.email, role: 'member', expectedConfigVersion: 2 });
  expect(invitation.status).toBe(201);
  const switched = await request(server)
    .post('/v1/auth/switch-workspace')
    .set('Authorization', `Bearer ${member.body.data.accessToken}`)
    .set('Origin', origin)
    .set('Cookie', cookieOf(member))
    .send({ workspaceId: id });
  expect(switched.status).toBe(200);
  const memberAuth = { Authorization: `Bearer ${switched.body.data.accessToken}` };
  expect(
    (
      await request(server)
        .patch(path)
        .set(memberAuth)
        .send({ expectedConfigVersion: 3, name: 'No' })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(server)
        .post(`${path}/archive`)
        .set(memberAuth)
        .send({ expectedConfigVersion: 3 })
    ).status,
  ).toBe(403);
  expect(
    (
      await request(server)
        .post(`${path}/restore`)
        .set(memberAuth)
        .send({ expectedConfigVersion: 3 })
    ).status,
  ).toBe(403);
  expect(
    (await request(server).post(`${path}/archive`).set(auth).send({ expectedConfigVersion: 3 }))
      .status,
  ).toBe(200);
  const page = await request(server).get('/v1/workspaces').set(memberAuth);
  expect(page.status).toBe(200);
  expect(page.body.items.some((workspace) => workspace.id === id)).toBe(false);
  const accepted = await request(server)
    .post('/v1/invitations/accept')
    .set('Authorization', `Bearer ${invitee.body.data.accessToken}`)
    .send({ token: invitation.body.data.token });
  expect(accepted.status).toBe(409);
  expect(accepted.body.error.code).toBe('INVITATION_UNAVAILABLE');
});
