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
  for (const name of ['Alice', 'Bob']) {
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
const create = (body = {}, actor = 'Bob') =>
  api()
    .post(`/v1/lists/${id(221)}/tasks`)
    .set(headers[actor])
    .send({
      title: 'Subtask API fixture',
      statusId: id(400),
      customFields: { effort: 0 },
      expectedConfigVersion: 1,
      ...body,
    });

test('subtasks use existing task operations and parent-filtered cursors cannot cross filters', async () => {
  const parent = (await create()).body.data;
  expect(parent.parentTaskId).toBeNull();
  const children = [];
  for (let index = 0; index < 3; index++) {
    const response = await create({ parentTaskId: parent.id });
    expect(response.status).toBe(201);
    children.push(response.body.data);
  }
  const page = await api()
    .get(`/v1/lists/${id(221)}/tasks`)
    .set(headers.Bob)
    .query({ parentTaskId: parent.id, limit: 1 });
  expect(page.status).toBe(200);
  expect(page.body.items.map((task) => task.id)).toEqual([children[0].id]);
  expect(page.body.pageInfo.hasNextPage).toBe(true);
  const next = await api()
    .get(`/v1/lists/${id(221)}/tasks`)
    .set(headers.Bob)
    .query({ parentTaskId: parent.id, limit: 1, cursor: page.body.pageInfo.nextCursor });
  expect(next.status).toBe(200);
  expect(next.body.items.map((task) => task.id)).toEqual([children[1].id]);
  const foreignFilter = await api()
    .get(`/v1/lists/${id(221)}/tasks`)
    .set(headers.Bob)
    .query({ parentTaskId: id(704), limit: 1, cursor: page.body.pageInfo.nextCursor });
  expect(foreignFilter.status).toBe(400);
  expect(foreignFilter.body.error.code).toBe('INVALID_CURSOR');
});

test('parent identities use the same permission and tenant policy as direct task access', async () => {
  for (const [parentTaskId, status] of [
    [id(708), 403],
    [id(900), 404],
  ]) {
    expect((await create({ parentTaskId })).status).toBe(status);
    expect(
      (
        await api()
          .get(`/v1/lists/${id(221)}/tasks`)
          .set(headers.Bob)
          .query({ parentTaskId })
      ).status,
    ).toBe(status);
  }
  const task = (await create()).body.data;
  expect(
    (
      await api()
        .patch(`/v1/tasks/${task.id}`)
        .set(headers.Bob)
        .send({ parentTaskId: id(708), expectedVersion: task.version, expectedConfigVersion: 1 })
    ).status,
  ).toBe(403);
});

test('parent errors have field paths and linked move/archive conflicts are typed', async () => {
  const parent = (await create()).body.data;
  const child = (await create({ parentTaskId: parent.id })).body.data;
  expect((await create({ parentTaskId: parent.id, customFields: {} })).status).toBe(400);
  expect(
    (await create({ parentTaskId: parent.id, customFields: { effort: 'wrong' } })).status,
  ).toBe(400);
  const depth = await create({ parentTaskId: child.id });
  expect(depth.status).toBe(400);
  expect(depth.body.error).toMatchObject({
    code: 'INVALID_PARENT',
    details: [expect.objectContaining({ path: ['parentTaskId'] })],
  });
  const invalid = await create({ parentTaskId: 'invalid' });
  expect(invalid.status).toBe(400);
  expect(invalid.body.error.details.some((issue) => issue.path.join('.') === 'parentTaskId')).toBe(
    true,
  );
  const archived = await api()
    .delete(`/v1/tasks/${parent.id}`)
    .set(headers.Bob)
    .send({ expectedConfigVersion: 1, expectedVersion: parent.version });
  expect(archived.status).toBe(409);
  expect(archived.body.error.code).toBe('TASK_RELATION_IN_USE');
  const moved = await api()
    .post(`/v1/tasks/${child.id}/move`)
    .set(headers.Alice)
    .send({
      destinationListId: id(222),
      placement: { edge: 'end' },
      expectedVersion: child.version,
      expectedConfigVersion: 1,
    });
  expect(moved.status).toBe(409);
  expect(moved.body.error.code).toBe('TASK_RELATION_IN_USE');
});

test('unrelated edits retain the parent and stale detach cannot overwrite a new revision', async () => {
  const parent = (await create()).body.data;
  const child = (await create({ parentTaskId: parent.id })).body.data;
  const edited = await api()
    .patch(`/v1/tasks/${child.id}`)
    .set(headers.Bob)
    .send({ title: 'Retained relation', expectedVersion: child.version, expectedConfigVersion: 1 });
  expect(edited.status).toBe(200);
  expect(edited.body.data.parentTaskId).toBe(parent.id);
  const detach = (version) =>
    api()
      .patch(`/v1/tasks/${child.id}`)
      .set(headers.Bob)
      .send({ parentTaskId: null, expectedVersion: version, expectedConfigVersion: 1 });
  expect((await detach(child.version)).status).toBe(409);
  const detached = await detach(edited.body.data.version);
  expect(detached.status).toBe(200);
  expect(detached.body.data.parentTaskId).toBeNull();
  expect((await api().get(`/v1/tasks/${child.id}`)).status).toBe(401);
});
