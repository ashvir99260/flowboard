import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';

import { createDatabase } from '@flowboard/database';
import { createLogger } from '@flowboard/logger';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin, cookieOf, SignupFixture } from '../../../test/common/auth-fixtures.mjs';

let fixture;
let owner;
let onWrite;
const api = () => request(fixture.app.getHttpServer());
const auth = () => ({ Authorization: `Bearer ${owner.accessToken}` });
beforeAll(async () => {
  fixture = await startTestApplication({
    auth: true,
    logger: createLogger({
      service: 'api',
      level: 'debug',
      write: (line) => {
        const event = JSON.parse(line);
        if (event.event === 'operation.started' && event.operation === 'hierarchy.write')
          onWrite?.();
      },
    }),
  });
  const response = await api()
    .post('/v1/auth/signup')
    .set('Origin', AuthTestOrigin)
    .send({ ...SignupFixture, email: `${randomUUID()}@example.test` });
  expect(response.status).toBe(201);
  owner = response.body.data;
});
afterAll(async () => fixture?.close());

async function group(names = ['A', 'B', 'C', 'D']) {
  const signed = await api()
    .post('/v1/auth/signup')
    .set('Origin', AuthTestOrigin)
    .send({ ...SignupFixture, email: `${randomUUID()}@example.test` });
  expect(signed.status).toBe(201);
  const session = signed.body.data;
  const header = { Authorization: `Bearer ${session.accessToken}` };
  const nodes = [];
  for (const name of names) {
    const created = await api()
      .post('/v1/nodes')
      .set(header)
      .send({ name, type: 'space', parentId: null, expectedConfigVersion: nodes.length + 1 });
    expect(created.status).toBe(201);
    nodes.push(created.body.data);
  }

  return { header, nodes, session, cookie: cookieOf(signed) };
}
async function move(header, nodeId, placement) {
  const before = await api().get(`/v1/nodes/${nodeId}`).set(header);
  expect(before.status).toBe(200);

  return api().post(`/v1/nodes/${nodeId}/reorder`).set(header).send({
    placement,
    expectedVersion: before.body.data.version,
    expectedConfigVersion: before.body.configVersion,
  });
}

test('moving a root sibling renumbers the changed set once and preserves a repeated no-op', async () => {
  const nodes = [];
  for (const name of ['First', 'Middle', 'Last']) {
    const response = await api()
      .post('/v1/nodes')
      .set(auth())
      .send({ name, type: 'space', parentId: null, expectedConfigVersion: nodes.length + 1 });
    expect(response.status).toBe(201);
    nodes.push(response.body.data);
  }
  const path = `/v1/nodes/${nodes[2].id}/reorder`;
  const moved = await api()
    .post(path)
    .set(auth())
    .send({ placement: { edge: 'start' }, expectedVersion: 1, expectedConfigVersion: 4 });
  expect(moved.status).toBe(200);
  expect(moved.body).toMatchObject({
    data: { id: nodes[2].id, position: 0, version: 2 },
    configVersion: 5,
    dataVersion: 5,
  });
  const tree = await api().get('/v1/tree').set(auth());
  expect(tree.body.items.map(({ id, position, version }) => ({ id, position, version }))).toEqual([
    { id: nodes[2].id, position: 0, version: 2 },
    { id: nodes[0].id, position: 1, version: 2 },
    { id: nodes[1].id, position: 2, version: 2 },
  ]);
  const unchanged = await api()
    .post(path)
    .set(auth())
    .send({ placement: { edge: 'start' }, expectedVersion: 2, expectedConfigVersion: 5 });
  expect(unchanged.status).toBe(200);
  expect(unchanged.body).toEqual(moved.body);
});

test('before, after and end placements preserve unrelated siblings and invalidate prior tree cursors', async () => {
  const { header, nodes } = await group();
  const old = await api().get('/v1/tree?limit=1').set(header);
  expect((await move(header, nodes[3].id, { beforeId: nodes[1].id })).status).toBe(200);
  expect((await api().get('/v1/tree').set(header)).body.items.map((node) => node.name)).toEqual([
    'A',
    'D',
    'B',
    'C',
  ]);
  const unchanged = await api().get(`/v1/nodes/${nodes[0].id}`).set(header);
  expect(unchanged.body.data).toEqual(nodes[0]);
  expect((await move(header, nodes[0].id, { afterId: nodes[1].id })).status).toBe(200);
  expect((await api().get('/v1/tree').set(header)).body.items.map((node) => node.name)).toEqual([
    'D',
    'B',
    'A',
    'C',
  ]);
  expect((await move(header, nodes[3].id, { edge: 'end' })).status).toBe(200);
  expect((await api().get('/v1/tree').set(header)).body.items.map((node) => node.name)).toEqual([
    'B',
    'A',
    'C',
    'D',
  ]);
  const stale = await api()
    .get('/v1/tree')
    .query({ limit: 1, cursor: old.body.pageInfo.nextCursor })
    .set(header);
  expect(stale.status).toBe(409);
  expect(stale.body.error.code).toBe('CURSOR_STALE');
});

test('singleton edges are no-ops and stale node/config versions reject without partial changes', async () => {
  const singleton = await group(['Only']);
  for (const edge of ['start', 'end']) {
    const response = await move(singleton.header, singleton.nodes[0].id, { edge });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: singleton.nodes[0], configVersion: 2, dataVersion: 2 });
  }
  const { header, nodes } = await group(['A', 'B']);
  const moved = await move(header, nodes[1].id, { edge: 'start' });
  expect(moved.status).toBe(200);
  const path = `/v1/nodes/${nodes[0].id}/reorder`;
  const staleConfig = await api()
    .post(path)
    .set(header)
    .send({ placement: { edge: 'start' }, expectedConfigVersion: 3, expectedVersion: 2 });
  expect(staleConfig.status).toBe(409);
  expect(staleConfig.body.error.code).toBe('CONFIG_CONFLICT');
  const staleNode = await api()
    .post(path)
    .set(header)
    .send({ placement: { edge: 'start' }, expectedConfigVersion: 4, expectedVersion: 1 });
  expect(staleNode.status).toBe(409);
  expect(staleNode.body.error.code).toBe('VERSION_CONFLICT');
  expect((await api().get('/v1/tree').set(header)).body.items.map((node) => node.name)).toEqual([
    'B',
    'A',
  ]);
});

test('reorder rejects invalid placement, wrong-parent/self/foreign/archived anchors and forged authority', async () => {
  const { header, nodes } = await group(['A', 'B']);
  const foreign = await group(['Other tenant']);
  const folder = await api()
    .post('/v1/nodes')
    .set(header)
    .send({ name: 'Folder', type: 'folder', parentId: nodes[0].id, expectedConfigVersion: 3 });
  expect(folder.status).toBe(201);
  const path = `/v1/nodes/${nodes[0].id}/reorder`;
  const input = { expectedVersion: 1, expectedConfigVersion: 4, placement: { edge: 'end' } };
  for (const placement of [
    {},
    { edge: 'middle' },
    { beforeId: 'bad' },
    { beforeId: nodes[1].id, afterId: nodes[1].id },
    { edge: 'start', beforeId: nodes[1].id },
    { position: 0 },
  ]) {
    const response = await api()
      .post(path)
      .set(header)
      .send({ ...input, placement });
    expect(response.status).toBe(400);
    expect(response.body.error.details).toBeDefined();
  }
  for (const extra of [
    { position: 0 },
    { workspaceId: foreign.session.activeWorkspace.id },
    { role: 'admin' },
    { actorUserId: foreign.session.user.id },
  ])
    expect(
      (
        await api()
          .post(path)
          .set(header)
          .send({ ...input, ...extra })
      ).status,
    ).toBe(400);
  for (const beforeId of [nodes[0].id.toUpperCase(), folder.body.data.id]) {
    const response = await api()
      .post(path)
      .set(header)
      .send({ ...input, placement: { beforeId } });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_ANCHOR');
  }
  for (const beforeId of [randomUUID(), foreign.nodes[0].id])
    expect(
      (
        await api()
          .post(path)
          .set(header)
          .send({ ...input, placement: { beforeId } })
      ).status,
    ).toBe(404);
  expect((await api().post(path).send(input)).status).toBe(401);
  expect((await api().post(path).set(foreign.header).send(input)).status).toBe(404);
  const archived = await api()
    .delete(`/v1/nodes/${nodes[1].id}`)
    .set(header)
    .send({ expectedConfigVersion: 4, expectedVersion: 1 });
  expect(archived.status).toBe(204);
  expect(
    (
      await api()
        .post(path)
        .set(header)
        .send({ ...input, expectedConfigVersion: 5, placement: { afterId: nodes[1].id } })
    ).status,
  ).toBe(404);
  expect(
    (
      await api()
        .post(path + '?offset=1')
        .set(header)
        .send({ ...input, expectedConfigVersion: 5 })
    ).status,
  ).toBe(400);
});

test('an administrator in another workspace cannot reorder as a member of this one', async () => {
  const target = await group(['A', 'B']);
  const member = await group([]);
  const added = await api()
    .post(`/v1/workspaces/${target.session.activeWorkspace.id}/members`)
    .set(target.header)
    .send({ email: member.session.user.email, role: 'member', expectedConfigVersion: 3 });
  expect(added.status).toBe(201);
  const switched = await api()
    .post('/v1/auth/switch-workspace')
    .set(member.header)
    .set('Cookie', member.cookie)
    .set('Origin', AuthTestOrigin)
    .send({ workspaceId: target.session.activeWorkspace.id });
  expect(switched.status).toBe(200);
  const response = await api()
    .post(`/v1/nodes/${target.nodes[0].id}/reorder`)
    .set('Authorization', `Bearer ${switched.body.data.accessToken}`)
    .send({ placement: { edge: 'end' }, expectedVersion: 1, expectedConfigVersion: 4 });
  expect(response.status).toBe(403);
});

test('reorder rechecks administrator rights after waiting for the workspace lock', async () => {
  const target = await group(['A', 'B']);
  const coadmin = await group([]);
  const added = await api()
    .post(`/v1/workspaces/${target.session.activeWorkspace.id}/members`)
    .set(target.header)
    .send({ email: coadmin.session.user.email, role: 'admin', expectedConfigVersion: 3 });
  expect(added.status).toBe(201);
  const database = createDatabase(fixture.infrastructure.databaseUrl);
  const context = {
    actorUserId: target.session.user.id,
    workspaceId: target.session.activeWorkspace.id,
  };
  let release;
  let signal;
  const locked = new Promise((resolve) => {
    signal = resolve;
  });
  const finish = new Promise((resolve) => {
    release = resolve;
  });
  const transaction = database.write(context, async (store) => {
    await store.memberships.update(context.actorUserId, {
      expectedConfigVersion: 4,
      role: 'member',
    });
    signal();
    await finish;
  });
  let pending;
  try {
    await locked;
    const began = new Promise((resolve) => {
      onWrite = resolve;
    });
    pending = api()
      .post(`/v1/nodes/${target.nodes[0].id}/reorder`)
      .set(target.header)
      .send({ placement: { edge: 'end' }, expectedVersion: 1, expectedConfigVersion: 4 })
      .then((response) => response);
    const timeout = new AbortController();
    try {
      await Promise.race([
        began,
        setTimeout(2000, undefined, { signal: timeout.signal }).then(() => {
          throw new Error('Reorder did not reach transaction boundary');
        }),
      ]);
    } finally {
      timeout.abort();
    }
    release();
    await transaction;
    expect((await pending).status).toBe(403);
    expect(
      (await api().get('/v1/tree').set(target.header)).body.items.map((node) => node.name),
    ).toEqual(['A', 'B']);
  } finally {
    onWrite = undefined;
    release();
    await Promise.allSettled([transaction, pending].filter(Boolean));
    await database.close();
  }
});
