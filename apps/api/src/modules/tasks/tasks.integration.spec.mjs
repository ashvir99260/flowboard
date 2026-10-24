import { DemoAccounts, DemoPassword, seedDemoData } from '@flowboard/database';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin } from '../../../test/common/auth-fixtures.mjs';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let fixture;
const headers = {};
const api = () => request(fixture.app.getHttpServer());
beforeAll(async () => {
  fixture = await startTestApplication({ auth: true });
  await seedDemoData(fixture.infrastructure.databaseUrl);
  for (const account of DemoAccounts) {
    const response = await api()
      .post('/v1/auth/login')
      .set('Origin', AuthTestOrigin)
      .send({ email: account.email, password: DemoPassword });
    expect(response.status).toBe(200);
    headers[account.name] = { Authorization: `Bearer ${response.body.data.accessToken}` };
  }
});
afterAll(async () => fixture?.close());

test('authorized task reads return stable pages, safe assignees and matching revisions', async () => {
  const page = await api()
    .get(`/v1/lists/${id(221)}/tasks?limit=2`)
    .set(headers.Bob);
  expect(page.status).toBe(200);
  expect(page.body.items).toHaveLength(2);
  expect(page.body.pageInfo.hasNextPage).toBe(true);
  const first = page.body.items[0];
  expect(first).toMatchObject({
    workspaceId: id(1),
    primaryListId: id(221),
    customFields: { effort: 1 },
  });
  expect(
    first.assignees.every((person) => Object.keys(person).sort().join(',') === 'id,name'),
  ).toBe(true);
  const detail = await api().get(`/v1/tasks/${first.id}`).set(headers.Bob);
  expect(detail.status).toBe(200);
  expect(detail.body.data).toEqual(first);
  expect(detail.body.configVersion).toBe(page.body.configVersion);
  expect(detail.body.dataVersion).toBe(page.body.dataVersion);
});

const listUrl = (list = 221) => `/v1/lists/${id(list)}/tasks`;
async function collect(query = {}, list = 221) {
  const tasks = [];
  let cursor;
  for (let page = 0; page < 20; page += 1) {
    const response = await api()
      .get(listUrl(list))
      .query({ limit: '2', ...query, ...(cursor ? { cursor } : {}) })
      .set(headers.Alice);
    expect(response.status).toBe(200);
    tasks.push(...response.body.items);
    expect(response.body.pageInfo.hasNextPage).toBe(response.body.pageInfo.nextCursor !== null);
    if (!response.body.pageInfo.hasNextPage) return tasks;

    cursor = response.body.pageInfo.nextCursor;
  }
  throw new Error('Task pagination did not terminate');
}

test.each([
  [{}, [700, 704, 701, 705, 702, 706, 703, 707]],
  [{ sort: 'dueDate' }, [701, 702, 704, 705, 707, 700, 703, 706]],
  [{ direction: 'desc', sort: 'dueDate' }, [707, 705, 704, 702, 701, 700, 703, 706]],
  [{ sort: 'priority' }, [700, 705, 701, 706, 702, 707, 703, 704]],
  [{ direction: 'desc', sort: 'priority' }, [704, 703, 702, 707, 701, 706, 700, 705]],
])('pagination uses stable complete ordering for %j', async (query, expected) => {
  const tasks = await collect(query);
  expect(tasks.map((task) => task.id)).toEqual(expected.map(id));
  expect(new Set(tasks.map((task) => task.id)).size).toBe(8);
});

test('combined built-in filters and typed scalar field filters run before pagination', async () => {
  expect(
    (await collect({ statusId: id(401), priority: 'high', assigneeId: id(102) })).map(
      (task) => task.id,
    ),
  ).toEqual([id(701)]);
  expect(
    (await collect({ fieldKey: 'effort', fieldOperator: 'eq', fieldValue: '3' })).map(
      (task) => task.id,
    ),
  ).toEqual([id(702)]);
  expect(
    (
      await collect({ fieldKey: 'team', fieldOperator: 'eq', fieldValue: JSON.stringify(id(610)) })
    ).map((task) => task.id),
  ).toEqual([701, 705, 703, 707].map(id));
  expect(
    (
      await collect({ fieldKey: 'release_date', fieldOperator: 'eq', fieldValue: '"2026-11-20"' })
    ).map((task) => task.id),
  ).toEqual([700, 704, 702, 706].map(id));
  expect(await collect({ priority: 'none', statusId: id(401) })).toEqual([]);
});

test.each([
  { fieldKey: 'effort' },
  { fieldKey: 'effort', fieldOperator: 'eq', fieldValue: '"3"' },
  { fieldKey: 'effort', fieldOperator: 'contains', fieldValue: '3' },
  { fieldKey: 'missing', fieldOperator: 'eq', fieldValue: '3' },
  { fieldKey: 'team', fieldOperator: 'eq', fieldValue: '"unknown"' },
  { fieldKey: 'team', fieldOperator: 'eq', fieldValue: JSON.stringify(id(613)) },
  { fieldKey: 'effort', fieldOperator: 'eq', fieldValue: 'null' },
  { fieldKey: 'effort', fieldOperator: 'eq', fieldValue: '[]' },
  { fieldKey: 'effort', fieldOperator: 'eq', fieldValue: '{' },
  { direction: 'desc' },
  { limit: '0' },
  { limit: '101' },
  { offset: '2' },
  { page: '1' },
])('invalid query %j returns a safe field path', async (query) => {
  const response = await api().get(listUrl()).query(query).set(headers.Alice);
  expect(response.status).toBe(400);
  expect(response.body.error.details).toBeDefined();
});

test('private, denied, foreign and missing task resources enforce the same access policy', async () => {
  for (const [url, actor, status] of [
    [listUrl(222), 'Bob', 403],
    [listUrl(223), 'Bob', 403],
    [listUrl(), 'Dan', 404],
    [`/v1/tasks/${id(708)}`, 'Bob', 403],
    [`/v1/tasks/${id(900)}`, 'Alice', 404],
    [`/v1/tasks/${id(799)}`, 'Alice', 404],
  ])
    expect((await api().get(url).set(headers[actor])).status).toBe(status);
  expect((await api().get(listUrl())).status).toBe(401);
  expect((await api().get(`/v1/tasks/${id(700)}`)).status).toBe(401);
  expect(
    (
      await api()
        .get(listUrl())
        .query({ statusId: id(800) })
        .set(headers.Alice)
    ).status,
  ).toBe(400);
  expect(
    (
      await api()
        .get(listUrl())
        .query({ assigneeId: id(104) })
        .set(headers.Alice)
    ).status,
  ).toBe(404);
  expect((await api().get(`${listUrl()}?limit=2&limit=3`).set(headers.Alice)).status).toBe(400);
});

test('task cursors bind caller, list, query and limit and reject stale configuration', async () => {
  const page = await api().get(listUrl()).query({ limit: '2' }).set(headers.Alice);
  const cursor = page.body.pageInfo.nextCursor;
  for (const [query, list, actor] of [
    [{ limit: '3' }, 221, 'Alice'],
    [{ limit: '2', priority: 'high' }, 221, 'Alice'],
    [{ limit: '2', sort: 'dueDate' }, 221, 'Alice'],
    [{ limit: '2' }, 222, 'Alice'],
    [{ limit: '2' }, 221, 'Carol'],
  ])
    expect(
      (
        await api()
          .get(listUrl(list))
          .query({ ...query, cursor })
          .set(headers[actor])
      ).status,
    ).toBe(400);
  expect(
    (
      await api()
        .get(listUrl())
        .query({ limit: '2', cursor: `${cursor}x` })
        .set(headers.Alice)
    ).status,
  ).toBe(400);
  const change = await api()
    .patch(`/v1/scopes/workspace/${id(1)}/fields/${id(601)}`)
    .set(headers.Alice)
    .send({ name: 'Updated effort', expectedConfigVersion: page.body.configVersion });
  expect(change.status).toBe(200);
  expect((await api().get(listUrl()).query({ limit: '2', cursor }).set(headers.Alice)).status).toBe(
    409,
  );
  expect((await collect()).map((task) => task.id)).toHaveLength(8);
});
