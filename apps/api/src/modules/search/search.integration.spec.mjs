import { DemoAccounts, DemoPassword, seedDemoData } from '@flowboard/database';
import { createLogger } from '@flowboard/logger';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin } from '../../../test/common/auth-fixtures.mjs';

const id = (value) => `f1000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const headers = {};
const logs = [];
let fixture;
const api = () => request(fixture.app.getHttpServer());
const search = (query, actor = 'Alice') =>
  api()
    .get('/v1/search')
    .set(headers[actor])
    .query({ limit: 100, ...query });
const version = async () => (await api().get('/v1/tree').set(headers.Alice)).body.configVersion;

beforeAll(async () => {
  fixture = await startTestApplication({
    auth: true,
    logger: createLogger({ service: 'api', level: 'debug', write: (line) => logs.push(line) }),
  });
  await fixture.app.listen(0, 'localhost');
  await seedDemoData(fixture.infrastructure.databaseUrl);
  for (const name of ['Alice', 'Bob', 'Carol', 'Dan']) {
    const account = DemoAccounts.find((entry) => entry.name === name);
    const response = await api()
      .post('/v1/auth/login')
      .set('Origin', AuthTestOrigin)
      .send({ email: account.email, password: DemoPassword });
    expect(response.status).toBe(200);
    headers[name] = { Authorization: `Bearer ${response.body.data.accessToken}` };
  }
});
afterAll(async () => fixture?.close());

async function create(title, list = 221, extra = {}) {
  const response = await api()
    .post(`/v1/lists/${id(list)}/tasks`)
    .set(headers.Alice)
    .send({
      title,
      statusId: id(400),
      customFields: { effort: 1 },
      expectedConfigVersion: await version(),
      ...extra,
    });
  expect(response.status).toBe(201);

  return response.body.data;
}

async function hits(query, actor = 'Alice') {
  const response = await search(query, actor);
  expect(response.status).toBe(200);

  return response.body.items;
}

test('global search returns visible tasks and lists with authorized breadcrumbs', async () => {
  const task = await create('GlobalNebula release notes');
  const descriptionTask = await create('Different heading', 223, {
    description: 'GlobalNebula lunar release notes',
  });
  const found = await hits({ q: '  GLOBALNEBULA  ' });
  expect(found.map((hit) => hit.id)).toEqual(expect.arrayContaining([task.id, descriptionTask.id]));
  expect(found.find((hit) => hit.id === task.id)).toEqual({
    id: task.id,
    type: 'task',
    title: task.title,
    containerId: id(221),
    path: ['Engineering', 'Delivery', 'Product backlog'],
  });
  expect(await hits({ q: '"lunar release"' })).toEqual([
    expect.objectContaining({ id: descriptionTask.id }),
  ]);
  expect(await hits({ q: 'GlobalNebul' })).toEqual([]);
  expect(await hits({ q: 'Product backlog' })).toContainEqual({
    id: id(221),
    type: 'list',
    title: 'Product backlog',
    containerId: id(211),
    path: ['Engineering', 'Delivery'],
  });
  expect(await hits({ q: '!!!' })).toEqual([]);
});

test('global search excludes private or denied ancestors and every other tenant', async () => {
  const publicTask = await create('BoundaryQuasar public');
  const privateTask = await create('BoundaryQuasar private', 222);
  const deniedTask = await create('BoundaryQuasar denied', 223);
  const memberHits = await hits({ q: 'BoundaryQuasar' }, 'Bob');
  expect(memberHits.map((hit) => hit.id)).toEqual([publicTask.id]);
  expect(await hits({ q: 'Private launch' }, 'Bob')).toEqual([]);
  expect(await hits({ q: 'BoundaryQuasar' }, 'Carol')).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: publicTask.id }),
      expect.objectContaining({ id: privateTask.id }),
      expect.objectContaining({ id: deniedTask.id }),
    ]),
  );
  expect(await hits({ q: 'Other tenant' })).toEqual([]);
  expect(await hits({ q: 'BoundaryQuasar' }, 'Dan')).toEqual([]);
  expect(await hits({ q: 'Other tenant' }, 'Dan')).toHaveLength(3);
  expect(await hits({ q: 'Operations' }, 'Bob')).toEqual([]);
});

test('mixed task and list matches page without duplicates or missing results', async () => {
  const task = await create('Product backlog planning');
  const expected = await hits({ q: 'Product backlog' });
  expect(expected.map((hit) => hit.type)).toContain('list');
  expect(expected.map((hit) => hit.id)).toContain(task.id);
  const actual = [];
  let cursor;
  do {
    const response = await search({
      q: 'Product backlog',
      limit: 1,
      ...(cursor ? { cursor } : {}),
    });
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    actual.push(...response.body.items);
    cursor = response.body.pageInfo.nextCursor;
  } while (cursor);
  expect(actual).toEqual(expected);
});

test('search cursor binds caller, workspace, query, limit and both revisions', async () => {
  await create('PagingGalaxy first');
  const secondTask = await create('PagingGalaxy second', 223);
  await create('PagingGalaxy third', 222);
  const first = await search({ limit: 1, q: 'PagingGalaxy' });
  expect(first.status).toBe(200);
  expect(first.body.items).toHaveLength(1);
  expect(first.body.pageInfo.hasNextPage).toBe(true);
  const cursor = first.body.pageInfo.nextCursor;
  const second = await search({ q: '  PagingGalaxy  ', limit: 1, cursor });
  expect(second.status).toBe(200);
  expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
  for (const [query, actor] of [
    [{ q: 'OtherGalaxy', limit: 1, cursor }, 'Alice'],
    [{ q: 'PagingGalaxy', limit: 2, cursor }, 'Alice'],
    [{ q: 'PagingGalaxy', limit: 1, cursor }, 'Bob'],
    [{ q: 'PagingGalaxy', limit: 1, cursor }, 'Dan'],
    [{ q: 'PagingGalaxy', limit: 1, cursor: `${cursor}x` }, 'Alice'],
  ]) {
    const response = await search(query, actor);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CURSOR');
  }
  const update = await api()
    .patch(`/v1/tasks/${secondTask.id}`)
    .set(headers.Alice)
    .send({
      title: 'PagingGalaxy changed',
      expectedVersion: 1,
      expectedConfigVersion: await version(),
    });
  expect(update.status).toBe(200);
  const staleData = await search({ q: 'PagingGalaxy', limit: 1, cursor });
  expect(staleData.status).toBe(409);
  expect(staleData.body.error.code).toBe('CURSOR_STALE');
  const fresh = await search({ limit: 1, q: 'PagingGalaxy' });
  const revoke = await api()
    .put(`/v1/nodes/${id(221)}/grants`)
    .set(headers.Alice)
    .send({ userId: id(103), mode: 'deny', expectedConfigVersion: await version() });
  expect(revoke.status).toBe(200);
  const staleConfig = await search({
    q: 'PagingGalaxy',
    limit: 1,
    cursor: fresh.body.pageInfo.nextCursor,
  });
  expect(staleConfig.status).toBe(409);
  expect(staleConfig.body.error.code).toBe('CURSOR_STALE');
  expect(
    (await hits({ q: 'PagingGalaxy' }, 'Carol')).some((hit) => hit.containerId === id(221)),
  ).toBe(false);
});

test('archived tasks and lists disappear immediately without leaking result content', async () => {
  const task = await create('ArchiveComet');
  const removeTask = await api()
    .delete(`/v1/tasks/${task.id}`)
    .set(headers.Alice)
    .send({ expectedVersion: task.version, expectedConfigVersion: await version() });
  expect(removeTask.status).toBe(204);
  expect(await hits({ q: 'ArchiveComet' })).toEqual([]);
  const listResponse = await api()
    .get(`/v1/nodes/${id(222)}`)
    .set(headers.Alice);
  const removeList = await api()
    .delete(`/v1/nodes/${id(222)}`)
    .set(headers.Alice)
    .send({
      expectedVersion: listResponse.body.data.version,
      expectedConfigVersion: await version(),
    });
  expect(removeList.status).toBe(204);
  expect(await hits({ q: 'Private launch' })).toEqual([]);
  expect((await hits({ q: 'BoundaryQuasar' })).some((hit) => hit.containerId === id(222))).toBe(
    false,
  );
});

test('global search validates inputs and never logs search content', async () => {
  expect((await api().get('/v1/search?q=task')).status).toBe(401);
  for (const q of ['', '   ', 'x'.repeat(201), 'value\0suffix']) {
    const response = await search({ q });
    expect(response.status).toBe(400);
    expect(response.body.error.details.some((issue) => issue.path[0] === 'q')).toBe(true);
  }
  for (const query of [{}, { offset: 1, q: 'task' }, { q: 'task', workspaceId: id(2) }])
    expect((await search(query)).status).toBe(400);
  expect((await api().get('/v1/search?q=one&q=two').set(headers.Alice)).status).toBe(400);
  expect((await search({ q: "' OR true; DROP TABLE tasks; --" })).status).toBe(200);
  const marker = 'NeverLogWorkspaceSearch';
  expect((await search({ q: marker })).status).toBe(200);
  expect(logs.join('')).not.toContain(marker);
});

test('allow on a descendant never leaks through a denied ancestor and empty access stays empty', async () => {
  for (const [nodeId, mode] of [
    [221, 'allow'],
    [211, 'deny'],
    [202, 'deny'],
  ]) {
    const response = await api()
      .put(`/v1/nodes/${id(nodeId)}/grants`)
      .set(headers.Alice)
      .send({ userId: id(102), mode, expectedConfigVersion: await version() });
    expect(response.status).toBe(200);
  }
  expect(await hits({ q: 'BoundaryQuasar' }, 'Bob')).toEqual([]);
  expect(await hits({ q: 'Product backlog' }, 'Bob')).toEqual([]);
});
