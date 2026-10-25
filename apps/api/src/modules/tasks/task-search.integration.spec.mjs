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
beforeAll(async () => {
  fixture = await startTestApplication({
    auth: true,
    logger: createLogger({ service: 'api', level: 'debug', write: (line) => logs.push(line) }),
  });
  await seedDemoData(fixture.infrastructure.databaseUrl);
  for (const name of ['Alice', 'Bob', 'Dan']) {
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

async function create(title, extra = {}, list = 221) {
  const response = await api()
    .post(`/v1/lists/${id(list)}/tasks`)
    .set(headers.Alice)
    .send({
      title,
      statusId: id(400),
      customFields: { effort: 1 },
      expectedConfigVersion: 1,
      ...extra,
    });
  expect(response.status).toBe(201);

  return response.body.data;
}
const search = (query, actor = 'Alice', list = 221) =>
  api()
    .get(`/v1/lists/${id(list)}/tasks`)
    .set(headers[actor])
    .query({ limit: 100, ...query });
const matchingIds = async (query, actor = 'Alice', list = 221) => {
  const response = await search(query, actor, list);
  expect(response.status).toBe(200);

  return response.body.items.map((task) => task.id);
};

test('search matches title and description lexemes case-insensitively and preserves phrases', async () => {
  const title = await create('DeepQuasar lunar release notes');
  const description = await create('Unrelated heading', {
    description: 'DeepQuasar documentation in the description.',
  });
  await create('DeepQuasar lunar delayed release');
  await create('DeepQuasarization is a different word');
  expect(await matchingIds({ q: '  DEEPQUASAR  ' })).toEqual(
    expect.arrayContaining([title.id, description.id]),
  );
  expect(await matchingIds({ q: 'DeepQuasar' })).toHaveLength(3);
  expect(await matchingIds({ q: '"lunar release"' })).toEqual([title.id]);
  expect(await matchingIds({ q: 'DeepQuas' })).toEqual([]);
  expect(await matchingIds({ q: '!!!' })).toEqual([]);
});

test('search combines typed field, status and parent filters before pagination', async () => {
  const parent = await create('FilterNebula parent', { customFields: { effort: 7 } });
  const child = await create('FilterNebula child', {
    parentTaskId: parent.id,
    customFields: { effort: 7 },
  });
  await create('FilterNebula other effort', { customFields: { effort: 8 } });
  expect(
    await matchingIds({
      q: 'FilterNebula',
      fieldKey: 'effort',
      fieldOperator: 'eq',
      fieldValue: '7',
      statusId: id(400),
    }),
  ).toEqual([parent.id, child.id]);
  expect(
    await matchingIds({
      q: 'FilterNebula',
      parentTaskId: parent.id,
      fieldKey: 'effort',
      fieldOperator: 'eq',
      fieldValue: '7',
    }),
  ).toEqual([child.id]);
});

test('search cursors bind the normalized query and reject a changed query or changed data', async () => {
  const first = await create('CursorGalaxy first');
  const second = await create('CursorGalaxy second');
  const page = await search({ limit: 1, q: 'CursorGalaxy' });
  expect(page.status).toBe(200);
  expect(page.body.pageInfo.hasNextPage).toBe(true);
  expect(page.body.items.map((task) => task.id)).toEqual([first.id]);
  const continued = await search({
    q: '  CursorGalaxy  ',
    limit: 1,
    cursor: page.body.pageInfo.nextCursor,
  });
  expect(continued.status).toBe(200);
  expect(continued.body.items.map((task) => task.id)).toEqual([second.id]);
  const changedQuery = await search({
    q: 'OtherGalaxy',
    limit: 1,
    cursor: page.body.pageInfo.nextCursor,
  });
  expect(changedQuery.status).toBe(400);
  expect(changedQuery.body.error.code).toBe('INVALID_CURSOR');
  const update = await api().patch(`/v1/tasks/${first.id}`).set(headers.Alice).send({
    description: 'Updated text',
    expectedVersion: first.version,
    expectedConfigVersion: 1,
  });
  expect(update.status).toBe(200);
  const changedData = await search({
    q: 'CursorGalaxy',
    limit: 1,
    cursor: page.body.pageInfo.nextCursor,
  });
  expect(changedData.status).toBe(409);
  expect(changedData.body.error.code).toBe('CURSOR_STALE');
});

test('edits, list moves and archive change search visibility immediately', async () => {
  const task = await create('MovingQuasar');
  expect(await matchingIds({ q: 'MovingQuasar' })).toEqual([task.id]);
  const edit = await api()
    .patch(`/v1/tasks/${task.id}`)
    .set(headers.Alice)
    .send({ title: 'MovedNebula', expectedVersion: task.version, expectedConfigVersion: 1 });
  expect(edit.status).toBe(200);
  expect(await matchingIds({ q: 'MovingQuasar' })).toEqual([]);
  expect(await matchingIds({ q: 'MovedNebula' })).toEqual([task.id]);
  const moved = await api()
    .post(`/v1/tasks/${task.id}/move`)
    .set(headers.Alice)
    .send({
      destinationListId: id(222),
      placement: { edge: 'end' },
      expectedVersion: edit.body.data.version,
      expectedConfigVersion: 1,
    });
  expect(moved.status).toBe(200);
  expect(await matchingIds({ q: 'MovedNebula' })).toEqual([]);
  expect(await matchingIds({ q: 'MovedNebula' }, 'Alice', 222)).toEqual([task.id]);
  const archived = await api()
    .delete(`/v1/tasks/${task.id}`)
    .set(headers.Alice)
    .send({ expectedVersion: moved.body.data.version, expectedConfigVersion: 1 });
  expect(archived.status).toBe(204);
  expect(await matchingIds({ q: 'MovedNebula' }, 'Alice', 222)).toEqual([]);
});

test('search retains private-list and tenant boundaries for hostile input too', async () => {
  await create('HiddenQuasar', {}, 222);
  expect((await search({ q: 'HiddenQuasar' }, 'Bob', 222)).status).toBe(403);
  expect((await search({ q: 'HiddenQuasar' }, 'Bob', 223)).status).toBe(403);
  expect((await search({ q: 'task' }, 'Alice', 321)).status).toBe(404);
  expect((await search({ q: 'task' }, 'Dan', 221)).status).toBe(404);
  expect(await matchingIds({ q: 'HiddenQuasar' }, 'Bob')).toEqual([]);
  const hostile = await search({ q: "' OR true; DROP TABLE tasks; --" }, 'Bob');
  expect(hostile.status).toBe(200);
  expect((await search({ q: 'HiddenQuasar' }, 'Bob', 222)).status).toBe(403);
});

test('invalid search input returns field validation errors and search content stays out of logs', async () => {
  for (const q of ['', '   ', 'x'.repeat(201), 'value\0suffix']) {
    const response = await search({ q });
    expect(response.status).toBe(400);
    expect(response.body.error.details.some((issue) => issue.path[0] === 'q')).toBe(true);
  }
  const repeated = await api()
    .get(`/v1/lists/${id(221)}/tasks?q=one&q=two`)
    .set(headers.Alice);
  expect(repeated.status).toBe(400);
  const marker = 'NeverLogThisSearchNeedle';
  expect((await search({ q: marker })).status).toBe(200);
  expect(logs.join('')).not.toContain(marker);
});
