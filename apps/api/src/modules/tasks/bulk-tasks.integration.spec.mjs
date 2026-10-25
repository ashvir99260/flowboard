import { DemoAccounts, DemoPassword, seedDemoData } from '@flowboard/database';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin } from '../../../test/common/auth-fixtures.mjs';

const id = (value) => `f1000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const headers = {};
let fixture;
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

async function create(list = 221, overrides = {}) {
  const response = await api()
    .post(`/v1/lists/${id(list)}/tasks`)
    .set(headers.Alice)
    .send({
      title: 'Bulk operation fixture',
      statusId: id(400),
      customFields: { effort: 1 },
      expectedConfigVersion: 1,
      ...overrides,
    });
  expect(response.status).toBe(201);

  return response.body.data;
}
const command = (tasks, patch, expectedConfigVersion = 1) => ({
  expectedConfigVersion,
  tasks: tasks.map((task) => ({ id: task.id, expectedVersion: task.version })),
  patch,
});
const read = async (task) => (await api().get(`/v1/tasks/${task.id}`).set(headers.Alice)).body;
const send = (body, actor = 'Alice') => api().patch('/v1/tasks').set(headers[actor]).send(body);

test('bulk updates return input order and all-no-op batches retain every revision', async () => {
  const first = await create();
  const second = await create();
  const updated = await send(
    command([second, first], { priority: 'high', customFields: { effort: 2 } }),
    'Bob',
  );
  expect(updated.status).toBe(200);
  expect(updated.body.data.map((task) => task.id)).toEqual([second.id, first.id]);
  expect(updated.body.changedTaskIds).toEqual([second.id, first.id]);
  expect(
    updated.body.data.every(
      (task) => task.priority === 'high' && task.customFields.effort === 2 && task.version === 2,
    ),
  ).toBe(true);
  const unchanged = await send(
    command(updated.body.data, { priority: 'high', customFields: { effort: 2 } }),
    'Bob',
  );
  expect(unchanged.status).toBe(200);
  expect(unchanged.body).toEqual({ ...updated.body, changedTaskIds: [] });
});

test('a stale later task or configuration rolls back earlier valid task updates', async () => {
  const first = await create();
  const second = await create();
  const before = [await read(first), await read(second)];
  const input = command([first, { ...second, version: 99 }], { priority: 'urgent' });
  const stale = await send(input);
  expect(stale.status).toBe(409);
  expect(stale.body.error.code).toBe('VERSION_CONFLICT');
  expect([await read(first), await read(second)]).toEqual(before);
  const staleConfig = await send(command([first, second], { priority: 'urgent' }, 99));
  expect(staleConfig.status).toBe(409);
  expect(staleConfig.body.error.code).toBe('CONFIG_CONFLICT');
  expect([await read(first), await read(second)]).toEqual(before);
});

test('mixed-list status and field validation reject the entire batch', async () => {
  const first = await create(222);
  const second = await create(221);
  const before = [await read(first), await read(second)];
  const status = await send(command([first, second], { statusId: id(405) }));
  expect(status.status).toBe(400);
  expect(status.body.error.code).toBe('STATUS_NOT_AVAILABLE');
  expect([await read(first), await read(second)]).toEqual(before);
  const field = await send(command([second, first], { customFields: { team: id(610) } }));
  expect(field.status).toBe(400);
  expect(field.body.error.code).toBe('FIELD_VALUE_INVALID');
  expect(
    field.body.error.details.some((issue) => issue.path.join('.') === 'patch.customFields.team'),
  ).toBe(true);
  expect([await read(first), await read(second)]).toEqual(before);
});

test('forbidden, foreign and archived targets cannot cause partial updates', async () => {
  const allowed = await create();
  const privateTask = await create(222);
  const before = await read(allowed);
  expect((await send(command([allowed, privateTask], { priority: 'high' }), 'Bob')).status).toBe(
    403,
  );
  expect(await read(allowed)).toEqual(before);
  expect(
    (await send(command([allowed, { id: id(900), version: 1 }], { priority: 'high' }), 'Bob'))
      .status,
  ).toBe(404);
  expect(await read(allowed)).toEqual(before);
  const archived = await api()
    .delete(`/v1/tasks/${privateTask.id}`)
    .set(headers.Alice)
    .send({ expectedConfigVersion: 1, expectedVersion: privateTask.version });
  expect(archived.status).toBe(204);
  const afterArchive = await read(allowed);
  expect((await send(command([allowed, privateTask], { priority: 'high' }))).status).toBe(404);
  expect(await read(allowed)).toEqual(afterArchive);
});

test('assignment access and required fields are validated for every selected list', async () => {
  const allowed = await create();
  const privateTask = await create(222);
  const before = [await read(allowed), await read(privateTask)];
  expect((await send(command([allowed, privateTask], { assigneeIds: [id(102)] }))).status).toBe(
    403,
  );
  expect([await read(allowed), await read(privateTask)]).toEqual(before);
  expect(
    (await send(command([allowed, privateTask], { customFields: { effort: null } }))).status,
  ).toBe(400);
  expect([await read(allowed), await read(privateTask)]).toEqual(before);
});

test('competing bulk commands yield one complete result and one stale conflict', async () => {
  const tasks = [await create(), await create()];
  const results = await Promise.all([
    send(command(tasks, { priority: 'high' })),
    send(command(tasks, { priority: 'urgent' })),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  const winner = results.find((result) => result.status === 200);
  expect((await Promise.all(tasks.map(read))).map((item) => item.data)).toEqual(winner.body.data);
});

test('bulk input is bounded and authentication remains required', async () => {
  const task = await create();
  const input = command([task], { priority: 'high' });
  expect((await api().patch('/v1/tasks').send(input)).status).toBe(401);
  for (const body of [
    { ...input, tasks: [] },
    { ...input, patch: {} },
    { ...input, tasks: [input.tasks[0], input.tasks[0]] },
    {
      ...input,
      tasks: Array.from({ length: 51 }, (_, index) => ({
        id: id(1000 + index),
        expectedVersion: 1,
      })),
    },
  ])
    expect((await send(body)).status).toBe(400);
});
