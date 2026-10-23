import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { createDatabase } from '@flowboard/database';
import { createLogger } from '@flowboard/logger';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin, cookieOf, SignupFixture } from '../../../test/common/auth-fixtures.mjs';

let fixture;
let session;
let onWrite;
const auth = () => ({ Authorization: `Bearer ${session.accessToken}` });
beforeAll(async () => {
  fixture = await startTestApplication({
    auth: true,
    logger: createLogger({
      service: 'api',
      level: 'debug',
      write: (line) => {
        const event = JSON.parse(line);
        if (event.event === 'operation.started' && event.operation === 'hierarchy.write')
          onWrite?.(event.userId);
      },
    }),
  });
  const response = await request(fixture.app.getHttpServer())
    .post('/v1/auth/signup')
    .set('Origin', AuthTestOrigin)
    .send(SignupFixture);
  expect(response.status).toBe(201);
  session = response.body.data;
});
afterAll(async () => fixture?.close());

test('admin creates and reads the strict hierarchy with server-owned positions and revisions', async () => {
  const server = fixture.app.getHttpServer();
  let configVersion = 1;
  let parentId = null;
  for (const type of ['space', 'folder', 'list']) {
    const response = await request(server)
      .post('/v1/nodes')
      .set(auth())
      .send({
        name: `  My ${type}  `,
        type,
        parentId,
        expectedConfigVersion: configVersion,
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      configVersion: configVersion + 1,
      dataVersion: configVersion + 1,
      data: {
        name: `My ${type}`,
        type,
        parentId,
        workspaceId: session.activeWorkspace.id,
        position: 0,
        version: 1,
        visibility: 'public',
        archivedAt: null,
      },
    });
    expect(response.body.data.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(response.body.data.createdAt).toBe(response.body.data.updatedAt);
    const read = await request(server).get(`/v1/nodes/${response.body.data.id}`).set(auth());
    expect(read.status).toBe(200);
    expect(read.body).toEqual(response.body);
    configVersion += 1;
    parentId = response.body.data.id;
  }
  const sibling = await request(server).post('/v1/nodes').set(auth()).send({
    name: 'Another space',
    type: 'space',
    parentId: null,
    expectedConfigVersion: configVersion,
  });
  expect(sibling.status).toBe(201);
  expect(sibling.body.data.position).toBe(1);
});

async function newOwner() {
  const response = await request(fixture.app.getHttpServer())
    .post('/v1/auth/signup')
    .set('Origin', AuthTestOrigin)
    .send({ ...SignupFixture, email: `${randomUUID()}@example.test` });
  expect(response.status).toBe(201);

  return { ...response.body.data, cookie: cookieOf(response) };
}

test('updates enforce both revisions and preserve no-op timestamps and versions', async () => {
  const owner = await newOwner();
  const auth = { Authorization: `Bearer ${owner.accessToken}` };
  const server = fixture.app.getHttpServer();
  const created = await request(server).post('/v1/nodes').set(auth).send({
    expectedConfigVersion: 1,
    name: 'Before',
    parentId: null,
    type: 'space',
  });
  expect(created.status).toBe(201);
  const path = `/v1/nodes/${created.body.data.id}`;
  const changed = await request(server).patch(path).set(auth).send({
    expectedConfigVersion: 2,
    expectedVersion: 1,
    name: ' After ',
    visibility: 'private',
  });
  expect(changed.status).toBe(200);
  expect(changed.body).toMatchObject({
    data: { name: 'After', version: 2, visibility: 'private' },
    configVersion: 3,
    dataVersion: 3,
  });
  expect(changed.body.data.createdAt).toBe(created.body.data.createdAt);
  const unchanged = await request(server).patch(path).set(auth).send({
    expectedConfigVersion: 3,
    expectedVersion: 2,
    name: 'After',
    visibility: 'private',
  });
  expect(unchanged.status).toBe(200);
  expect(unchanged.body).toEqual(changed.body);
  const staleNode = await request(server)
    .patch(path)
    .set(auth)
    .send({ expectedConfigVersion: 3, expectedVersion: 1, name: 'Lost' });
  expect(staleNode.status).toBe(409);
  expect(staleNode.body.error.code).toBe('VERSION_CONFLICT');
  const staleConfig = await request(server)
    .patch(path)
    .set(auth)
    .send({ expectedConfigVersion: 2, expectedVersion: 2, name: 'Lost' });
  expect(staleConfig.status).toBe(409);
  expect(staleConfig.body.error.code).toBe('CONFIG_CONFLICT');
  expect((await request(server).get(path).set(auth)).body).toEqual(changed.body);
});

test('archiving removes the live subtree from reads and keeps sibling containers visible', async () => {
  const owner = await newOwner();
  const auth = { Authorization: `Bearer ${owner.accessToken}` };
  const server = fixture.app.getHttpServer();
  const nodes = [];
  for (const type of ['space', 'folder', 'list']) {
    const created = await request(server)
      .post('/v1/nodes')
      .set(auth)
      .send({
        name: type,
        type,
        parentId: nodes.at(-1)?.id ?? null,
        expectedConfigVersion: nodes.length + 1,
      });
    expect(created.status).toBe(201);
    nodes.push(created.body.data);
  }
  const sibling = await request(server)
    .post('/v1/nodes')
    .set(auth)
    .send({ name: 'Sibling', type: 'folder', parentId: nodes[0].id, expectedConfigVersion: 4 });
  expect(sibling.status).toBe(201);
  const target = `/v1/nodes/${nodes[1].id}`;
  const archived = await request(server)
    .delete(target)
    .set(auth)
    .send({ expectedConfigVersion: 5, expectedVersion: 1 });
  expect(archived.status).toBe(204);
  expect(archived.text).toBe('');
  for (const node of nodes.slice(1))
    expect((await request(server).get(`/v1/nodes/${node.id}`).set(auth)).status).toBe(404);
  const rejectedChild = await request(server)
    .post('/v1/nodes')
    .set(auth)
    .send({ name: 'Late list', type: 'list', parentId: nodes[1].id, expectedConfigVersion: 6 });
  expect(rejectedChild.status).toBe(404);
  expect(
    (
      await request(server)
        .patch(target)
        .set(auth)
        .send({ expectedConfigVersion: 6, expectedVersion: 2, name: 'Hidden edit' })
    ).status,
  ).toBe(404);
  const survivor = await request(server).get(`/v1/nodes/${sibling.body.data.id}`).set(auth);
  expect(survivor.status).toBe(200);
  expect(survivor.body).toMatchObject({
    data: { archivedAt: null, version: 1 },
    configVersion: 6,
    dataVersion: 6,
  });
  expect(
    (
      await request(server)
        .delete(target)
        .set(auth)
        .send({ expectedConfigVersion: 6, expectedVersion: 2 })
    ).status,
  ).toBe(404);
});

test('strict inputs reject invalid fields, parent levels and unsupported reparenting', async () => {
  const server = fixture.app.getHttpServer();
  const header = auth();
  const root = await request(server)
    .get(`/v1/workspaces/${session.activeWorkspace.id}/members`)
    .set(header);
  const version = root.body.configVersion;
  const create = { name: 'Valid', type: 'space', parentId: null, expectedConfigVersion: version };
  for (const patch of [
    { name: '' },
    { name: ' '.repeat(4) },
    { name: 'x'.repeat(121) },
    { type: 'workspace' },
    { visibility: 'secret' },
    { parentId: 'invalid' },
    { expectedConfigVersion: 0 },
    { position: 3 },
    { workspaceId: randomUUID() },
    { createdAt: '2026-10-24T00:00:00Z' },
  ]) {
    const response = await request(server)
      .post('/v1/nodes')
      .set(header)
      .send({ ...create, ...patch });
    expect(response.status).toBe(400);
    expect(response.body.error.details).toBeDefined();
  }
  for (const type of ['folder', 'list']) {
    const response = await request(server)
      .post('/v1/nodes')
      .set(header)
      .send({ ...create, type });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_PARENT');
    expect(response.body.error.details[0].path).toEqual(['parentId']);
  }
  const space = await request(server).post('/v1/nodes').set(header).send(create);
  expect(space.status).toBe(201);
  const config = space.body.configVersion;
  const path = `/v1/nodes/${space.body.data.id}`;
  for (const type of ['space', 'list']) {
    const wrongLevel = await request(server)
      .post('/v1/nodes')
      .set(header)
      .send({ ...create, type, parentId: space.body.data.id, expectedConfigVersion: config });
    expect(wrongLevel.status).toBe(400);
    expect(wrongLevel.body.error.code).toBe('INVALID_PARENT');
  }
  for (const patch of [
    {},
    { parentId: space.body.data.id },
    { type: 'folder' },
    { id: randomUUID() },
    { name: null },
    { visibility: null },
    { position: 0 },
  ]) {
    const response = await request(server)
      .patch(path)
      .set(header)
      .send({ expectedVersion: 1, expectedConfigVersion: config, ...patch });
    expect(response.status).toBe(400);
    expect(response.body.error.details).toBeDefined();
  }
  for (const suffix of ['?offset=1', '?page=2', '?limit=1', '?anything=x'])
    expect(
      (
        await request(server)
          .get(path + suffix)
          .set(header)
      ).status,
    ).toBe(400);
  expect((await request(server).get('/v1/nodes/not-a-uuid').set(header)).status).toBe(400);
  const staleArchive = await request(server)
    .delete(path)
    .set(header)
    .send({ expectedVersion: 5, expectedConfigVersion: config });
  expect(staleArchive.status).toBe(409);
  expect(staleArchive.body.error.code).toBe('VERSION_CONFLICT');
});

test('all hierarchy operations require identity and keep administration workspace-local', async () => {
  const server = fixture.app.getHttpServer();
  const unknown = randomUUID();
  for (const [method, path] of [
    ['post', '/v1/nodes'],
    ['get', `/v1/nodes/${unknown}`],
    ['patch', `/v1/nodes/${unknown}`],
    ['delete', `/v1/nodes/${unknown}`],
  ])
    expect((await request(server)[method](path)).status).toBe(401);
  const owner = await newOwner();
  const other = await newOwner();
  const otherAuth = { Authorization: `Bearer ${other.accessToken}` };
  const created = await request(server)
    .post('/v1/nodes')
    .set(otherAuth)
    .send({ expectedConfigVersion: 1, name: 'Foreign', parentId: null, type: 'space' });
  expect(created.status).toBe(201);
  const foreignPath = `/v1/nodes/${created.body.data.id}`;
  const ownerAuth = { Authorization: `Bearer ${owner.accessToken}` };
  for (const method of ['get', 'patch', 'delete']) {
    const response = await request(server)
      [method](foreignPath)
      .set(ownerAuth)
      .send(
        method === 'get'
          ? undefined
          : {
              ...(method === 'patch' ? { name: 'Stolen' } : {}),
              expectedVersion: 1,
              expectedConfigVersion: 1,
            },
      );
    expect(response.status).toBe(404);
  }
  const foreignParent = await request(server).post('/v1/nodes').set(ownerAuth).send({
    name: 'Foreign child',
    type: 'folder',
    parentId: created.body.data.id,
    expectedConfigVersion: 1,
  });
  expect(foreignParent.status).toBe(404);
  const joined = await request(server)
    .post(`/v1/workspaces/${other.activeWorkspace.id}/members`)
    .set(otherAuth)
    .send({ email: owner.user.email, role: 'member', expectedConfigVersion: 2 });
  expect(joined.status).toBe(201);
  const switched = await request(server)
    .post('/v1/auth/switch-workspace')
    .set(ownerAuth)
    .set('Cookie', owner.cookie)
    .set('Origin', AuthTestOrigin)
    .send({ workspaceId: other.activeWorkspace.id });
  expect(switched.status).toBe(200);
  const memberAuth = { Authorization: `Bearer ${switched.body.data.accessToken}` };
  expect((await request(server).get(foreignPath).set(memberAuth)).status).toBe(200);
  for (const [method, path] of [
    ['post', '/v1/nodes'],
    ['patch', foreignPath],
    ['delete', foreignPath],
  ])
    expect((await request(server)[method](path).set(memberAuth)).status).toBe(403);
});

test('a request waiting for the workspace lock rechecks a revoked administrator role', async () => {
  const owner = await newOwner();
  const coadmin = await newOwner();
  const server = fixture.app.getHttpServer();
  const header = { Authorization: `Bearer ${owner.accessToken}` };
  const added = await request(server)
    .post(`/v1/workspaces/${owner.activeWorkspace.id}/members`)
    .set(header)
    .send({ email: coadmin.user.email, role: 'admin', expectedConfigVersion: 1 });
  expect(added.status).toBe(201);
  const database = createDatabase(fixture.infrastructure.databaseUrl);
  const context = { workspaceId: owner.activeWorkspace.id, actorUserId: owner.user.id };
  let release;
  let locked;
  const acquired = new Promise((resolve) => {
    locked = resolve;
  });
  const commit = new Promise((resolve) => {
    release = resolve;
  });
  let pending;
  const transaction = database.write(context, async (store) => {
    await store.memberships.update(owner.user.id, { expectedConfigVersion: 2, role: 'member' });
    locked();
    await commit;
  });
  try {
    await acquired;
    let began;
    const started = new Promise((resolve) => {
      began = resolve;
    });
    onWrite = (userId) => {
      if (userId === owner.user.id) began();
    };
    pending = request(server)
      .post('/v1/nodes')
      .set(header)
      .send({ expectedConfigVersion: 2, name: 'Denied after lock', parentId: null, type: 'space' })
      .then((response) => response);
    const timeout = new AbortController();
    try {
      await Promise.race([
        started,
        setTimeout(2000, undefined, { signal: timeout.signal }).then(() => {
          throw new Error('Request did not reach the write boundary');
        }),
      ]);
    } finally {
      timeout.abort();
    }
    release();
    await transaction;
    expect((await pending).status).toBe(403);
    expect(await database.read(context, (store) => store.nodes.countChildren(null))).toBe(0);
  } finally {
    onWrite = undefined;
    release();
    await Promise.allSettled([transaction, pending].filter(Boolean));
    await database.close();
  }
});
