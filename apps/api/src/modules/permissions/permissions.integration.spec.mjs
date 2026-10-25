import { setTimeout } from 'node:timers/promises';

import { createDatabase, DemoAccounts, DemoPassword, seedDemoData } from '@flowboard/database';
import { createLogger } from '@flowboard/logger';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin } from '../../../test/common/auth-fixtures.mjs';

const id = (value) => `f1000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
let fixture;
let onGrantWrite;
const sessions = {};
const header = (user) => ({ Authorization: `Bearer ${sessions[user].accessToken}` });
const api = () => request(fixture.app.getHttpServer());
const version = async () => (await api().get('/v1/tree').set(header('Alice'))).body.configVersion;
async function grant(resource, user, mode) {
  const expectedConfigVersion = await version();
  const response = await api()
    .put(`/v1/nodes/${id(resource)}/grants`)
    .set(header('Alice'))
    .send({ userId: id(user), mode, expectedConfigVersion });
  expect(response.status).toBe(200);

  return response;
}
async function removeGrant(resource, user) {
  const expectedConfigVersion = await version();
  expect(
    (
      await api()
        .delete(`/v1/nodes/${id(resource)}/grants/${id(user)}`)
        .set(header('Alice'))
        .send({ expectedConfigVersion })
    ).status,
  ).toBe(204);
}
beforeAll(async () => {
  fixture = await startTestApplication({
    auth: true,
    logger: createLogger({
      service: 'api',
      level: 'debug',
      write: (line) => {
        const event = JSON.parse(line);
        if (event.event === 'operation.started' && event.operation === 'permissions.grants.upsert')
          onGrantWrite?.();
      },
    }),
  });
  await seedDemoData(fixture.infrastructure.databaseUrl);
  for (const account of DemoAccounts) {
    const response = await api()
      .post('/v1/auth/login')
      .set('Origin', AuthTestOrigin)
      .send({ email: account.email, password: DemoPassword });
    expect(response.status).toBe(200);
    sessions[account.name] = response.body.data;
  }
});
afterAll(async () => fixture?.close());

test('tree and direct reads share seeded tenant-local ancestor permissions', async () => {
  for (const [user, count] of [
    ['Alice', 13],
    ['Bob', 5],
    ['Carol', 7],
  ]) {
    const response = await api().get('/v1/tree').set(header(user));
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(count);
    expect(response.body.root).toEqual({ id: id(1), name: 'Flowboard Demo', type: 'workspace' });
    expect(response.body.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });
    expect(response.body.items.map((node) => node.id)).toEqual(
      [201, 202, 203, 211, 212, 213, 214, 221, 222, 223, 224, 225, 226]
        .filter((n) => user === 'Alice' || ![203, 213, 214, 224, 225, 226].includes(n))
        .filter((n) => user !== 'Bob' || ![222, 223].includes(n))
        .map(id),
    );
  }
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(221)}`)
        .set(header('Bob'))
    ).status,
  ).toBe(200);
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(222)}`)
        .set(header('Bob'))
    ).status,
  ).toBe(403);
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(223)}`)
        .set(header('Bob'))
    ).status,
  ).toBe(403);
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(201)}`)
        .set(header('Dan'))
    ).status,
  ).toBe(404);
  expect((await api().get('/v1/tree')).status).toBe(401);
  for (const method of ['get', 'put', 'delete']) {
    const path = `/v1/nodes/${id(222)}/grants${method === 'delete' ? `/${id(102)}` : ''}`;
    expect((await api()[method](path)).status).toBe(401);
  }
  for (const method of ['patch', 'delete'])
    expect(
      (
        await api()
          [method](`/v1/nodes/${id(201)}`)
          .set(header('Dan'))
      ).status,
    ).toBe(404);
});

test('Operations members see different boards and denied ancestors block task reads', async () => {
  for (const [user, expected] of [
    ['Alice', [221, 222, 223, 224, 225, 226]],
    ['Bob', [221]],
    ['Carol', [221, 222, 223]],
    ['Eve', [221, 223, 224, 225, 226]],
    ['Frank', [221, 223, 226]],
  ]) {
    const response = await api().get('/v1/tree').set(header(user));
    expect(response.status).toBe(200);
    expect(
      response.body.items
        .filter((node) => node.type === 'list')
        .map((node) => node.id)
        .sort(),
    ).toEqual(expected.map(id).sort());
  }
  for (const [user, task, status] of [
    ['Eve', 1000, 200],
    ['Frank', 1000, 403],
    ['Bob', 1000, 403],
    ['Frank', 1016, 200],
    ['Dan', 1000, 404],
  ]) {
    expect(
      (
        await api()
          .get(`/v1/tasks/${id(task)}`)
          .set(header(user))
      ).status,
    ).toBe(status);
  }
});

test('grant writes check revisions, target membership and admin rights without changing data revisions', async () => {
  const path = `/v1/nodes/${id(222)}/grants`;
  const initial = await api().get(path).set(header('Alice'));
  expect(initial.status).toBe(200);
  const beforeTree = await api().get('/v1/tree').set(header('Alice'));
  const input = {
    userId: id(102),
    mode: 'allow',
    expectedConfigVersion: initial.body.configVersion,
  };
  expect((await api().put(path).set(header('Bob')).send(input)).status).toBe(403);
  expect(
    (
      await api()
        .put(path)
        .set(header('Alice'))
        .send({ ...input, userId: id(104) })
    ).status,
  ).toBe(404);
  const added = await api().put(path).set(header('Alice')).send(input);
  expect(added.status).toBe(200);
  expect(added.body).toMatchObject({
    data: { resourceId: id(222), userId: id(102), mode: 'allow' },
    configVersion: input.expectedConfigVersion + 1,
  });
  expect(Object.keys(added.body.data).sort()).toEqual([
    'createdAt',
    'mode',
    'resourceId',
    'updatedAt',
    'userId',
  ]);
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(222)}`)
        .set(header('Bob'))
    ).status,
  ).toBe(200);
  const unchanged = await api()
    .put(path)
    .set(header('Alice'))
    .send({ ...input, expectedConfigVersion: added.body.configVersion });
  expect(unchanged.body).toEqual(added.body);
  expect((await api().put(path).set(header('Alice')).send(input)).status).toBe(409);
  const afterTree = await api().get('/v1/tree').set(header('Alice'));
  expect(afterTree.body.dataVersion).toBe(beforeTree.body.dataVersion);
  const removed = await api()
    .delete(`${path}/${id(102)}`)
    .set(header('Alice'))
    .send({ expectedConfigVersion: added.body.configVersion });
  expect(removed.status).toBe(204);
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(222)}`)
        .set(header('Bob'))
    ).status,
  ).toBe(403);
  expect(
    (
      await api()
        .delete(`${path}/${id(102)}`)
        .set(header('Alice'))
        .send({ expectedConfigVersion: added.body.configVersion + 1 })
    ).status,
  ).toBe(204);
  expect((await api().get(path).set(header('Bob'))).status).toBe(403);
  expect((await api().get(path).set(header('Dan'))).status).toBe(404);
});

test('child allows never bypass a denied or private ancestor, while admins still see the tenant tree', async () => {
  await grant(221, 102, 'allow');
  await grant(211, 102, 'deny');
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(221)}`)
        .set(header('Bob'))
    ).status,
  ).toBe(403);
  expect(
    (await api().get('/v1/tree').set(header('Bob'))).body.items.map((node) => node.id),
  ).not.toContain(id(211));
  expect((await api().get('/v1/tree').set(header('Alice'))).body.items).toHaveLength(13);
  await removeGrant(211, 102);
  const before = await api()
    .get(`/v1/nodes/${id(211)}`)
    .set(header('Alice'));
  const privateVersion = await version();
  const makePrivate = await api()
    .patch(`/v1/nodes/${id(211)}`)
    .set(header('Alice'))
    .send({
      visibility: 'private',
      expectedVersion: before.body.data.version,
      expectedConfigVersion: privateVersion,
    });
  expect(makePrivate.status).toBe(200);
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(221)}`)
        .set(header('Bob'))
    ).status,
  ).toBe(403);
  await grant(211, 102, 'allow');
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(221)}`)
        .set(header('Bob'))
    ).status,
  ).toBe(200);
  const restoreVersion = await version();
  const restore = await api()
    .patch(`/v1/nodes/${id(211)}`)
    .set(header('Alice'))
    .send({
      visibility: 'public',
      expectedVersion: makePrivate.body.data.version,
      expectedConfigVersion: restoreVersion,
    });
  expect(restore.status).toBe(200);
  await removeGrant(211, 102);
  await removeGrant(221, 102);
});

test('cursor pages filter before limiting, keep parents first and bind all caller inputs', async () => {
  const expected = (await api().get('/v1/tree').set(header('Alice'))).body.items.map(
    (node) => node.id,
  );
  const first = await api().get('/v1/tree?limit=2').set(header('Alice'));
  expect(first.status).toBe(200);
  let page = first;
  const found = [];
  do {
    found.push(...page.body.items.map((node) => node.id));
    if (!page.body.pageInfo.hasNextPage) break;

    page = await api()
      .get('/v1/tree')
      .query({ limit: 2, cursor: page.body.pageInfo.nextCursor })
      .set(header('Alice'));
    expect(page.status).toBe(200);
  } while (found.length < expected.length);
  expect(found).toEqual(expected);
  const cursor = first.body.pageInfo.nextCursor;
  for (const [who, query] of [
    ['Bob', { limit: 2, cursor }],
    ['Alice', { limit: 3, cursor }],
    ['Alice', { limit: 2, cursor: cursor + 'x' }],
  ]) {
    expect((await api().get('/v1/tree').query(query).set(header(who))).status).toBe(400);
  }
  for (const query of ['offset=1', 'page=2', 'limit=101', 'limit=1&limit=2', 'cursor=bad'])
    expect(
      (
        await api()
          .get('/v1/tree?' + query)
          .set(header('Alice'))
      ).status,
    ).toBe(400);
  const filtered = await api().get('/v1/tree?limit=5').set(header('Bob'));
  expect(filtered.body.items).toHaveLength(5);
  expect(filtered.body.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });
  await grant(201, 102, 'deny');
  await grant(202, 102, 'deny');
  const empty = await api().get('/v1/tree?limit=1').set(header('Bob'));
  expect(empty.status).toBe(200);
  expect(empty.body.items).toEqual([]);
  expect(empty.body.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });
  expect(empty.body.root.id).toBe(id(1));
  const stale = await api().get('/v1/tree').query({ limit: 2, cursor }).set(header('Alice'));
  expect(stale.status).toBe(409);
  expect(stale.body.error.code).toBe('CURSOR_STALE');
  await removeGrant(201, 102);
  await removeGrant(202, 102);
});

test('grant pages bind the resource and revisions and reject forged authority or malformed input', async () => {
  const path = `/v1/nodes/${id(222)}/grants`;
  await grant(222, 102, 'allow');
  const page = await api()
    .get(path + '?limit=1')
    .set(header('Alice'));
  expect(page.status).toBe(200);
  expect(page.body.items).toHaveLength(1);
  const cursor = page.body.pageInfo.nextCursor;
  expect(cursor).toEqual(expect.any(String));
  const next = await api().get(path).query({ limit: 1, cursor }).set(header('Alice'));
  expect(next.status).toBe(200);
  expect(next.body.items).toHaveLength(1);
  expect(next.body.items[0].userId).not.toBe(page.body.items[0].userId);
  expect(next.body.pageInfo.hasNextPage).toBe(false);
  expect(
    (
      await api()
        .get(`/v1/nodes/${id(221)}/grants`)
        .query({ limit: 1, cursor })
        .set(header('Alice'))
    ).status,
  ).toBe(400);
  for (const patch of [
    { mode: 'edit' },
    { userId: 'bad' },
    { role: 'admin' },
    { workspaceId: id(2) },
    { actorUserId: id(101) },
    { expectedConfigVersion: 0 },
  ]) {
    const expectedConfigVersion = await version();
    const response = await api()
      .put(path)
      .set(header('Alice'))
      .send({ userId: id(102), mode: 'allow', expectedConfigVersion, ...patch });
    expect(response.status).toBe(400);
    expect(response.body.error.details).toBeDefined();
  }
  await removeGrant(222, 102);
  expect((await api().get(path).query({ limit: 1, cursor }).set(header('Alice'))).status).toBe(409);
});

test('a grant writer rechecks a demoted administrator after waiting for the workspace lock', async () => {
  const promotionVersion = await version();
  const promoted = await api()
    .patch(`/v1/workspaces/${id(1)}/members/${id(103)}`)
    .set(header('Alice'))
    .send({ role: 'admin', expectedConfigVersion: promotionVersion });
  expect(promoted.status).toBe(200);
  const revision = await version();
  const database = createDatabase(fixture.infrastructure.databaseUrl);
  const context = { workspaceId: id(1), actorUserId: id(101) };
  let release;
  let signal;
  const locked = new Promise((resolve) => {
    signal = resolve;
  });
  const finish = new Promise((resolve) => {
    release = resolve;
  });
  const transaction = database.write(context, async (store) => {
    await store.memberships.update(id(101), { role: 'member', expectedConfigVersion: revision });
    signal();
    await finish;
  });
  let pending;
  try {
    await locked;
    const began = new Promise((resolve) => {
      onGrantWrite = resolve;
    });
    pending = api()
      .put(`/v1/nodes/${id(221)}/grants`)
      .set(header('Alice'))
      .send({ userId: id(102), mode: 'allow', expectedConfigVersion: revision })
      .then((response) => response);
    const timeout = new AbortController();
    try {
      await Promise.race([
        began,
        setTimeout(2000, undefined, { signal: timeout.signal }).then(() => {
          throw new Error('Grant writer did not reach transaction boundary');
        }),
      ]);
    } finally {
      timeout.abort();
    }
    release();
    await transaction;
    expect((await pending).status).toBe(403);
    const current = await database.read({ workspaceId: id(1), actorUserId: id(103) }, (store) =>
      store.access.configuration(),
    );
    const restored = await api()
      .patch(`/v1/workspaces/${id(1)}/members/${id(101)}`)
      .set(header('Carol'))
      .send({ role: 'admin', expectedConfigVersion: current.configVersion });
    expect(restored.status).toBe(200);
    expect(await database.read(context, (store) => store.grants.find(id(221), id(102)))).toBeNull();
  } finally {
    onGrantWrite = undefined;
    release();
    await Promise.allSettled([transaction, pending].filter(Boolean));
    await database.close();
  }
});
