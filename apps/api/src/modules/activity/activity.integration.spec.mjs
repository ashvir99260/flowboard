import {
  createEventConsumerRepository,
  createOutboxRepository,
  DemoAccounts,
  DemoPassword,
  seedDemoData,
} from '@flowboard/database';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin } from '../../../test/common/auth-fixtures.mjs';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let fixture;
let consumer;
let outbox;
const headers = {};
const api = () => request(fixture.app.getHttpServer());
beforeAll(async () => {
  fixture = await startTestApplication({ auth: true });
  await seedDemoData(fixture.infrastructure.databaseUrl);
  consumer = createEventConsumerRepository(fixture.infrastructure.databaseUrl);
  outbox = createOutboxRepository(fixture.infrastructure.databaseUrl);
  for (const account of DemoAccounts) {
    const response = await api()
      .post('/v1/auth/login')
      .set('Origin', AuthTestOrigin)
      .send({ email: account.email, password: DemoPassword });
    expect(response.status).toBe(200);
    headers[account.name] = { Authorization: `Bearer ${response.body.data.accessToken}` };
  }
});
afterAll(async () => {
  await consumer?.close();
  await outbox?.close();
  await fixture?.close();
});

test('visible task activity returns an empty cursor page without leaking task or identity data', async () => {
  const response = await api()
    .get(`/v1/tasks/${id(700)}/activity`)
    .set(headers.Bob);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ items: [], pageInfo: { hasNextPage: false, nextCursor: null } });
});

async function changeStatus(statusId) {
  const detail = await api()
    .get(`/v1/tasks/${id(700)}`)
    .set(headers.Alice);
  const response = await api()
    .patch(`/v1/tasks/${id(700)}`)
    .set(headers.Alice)
    .send({
      statusId,
      expectedVersion: detail.body.data.version,
      expectedConfigVersion: detail.body.configVersion,
    });
  expect(response.status).toBe(200);
  const claims = await outbox.claim({ leaseMs: 30000, limit: 100 });
  for (const event of claims) {
    const claim = await consumer.claim(
      { schemaVersion: 1, eventId: event.id, workspaceId: event.workspaceId },
      30000,
    );
    expect((await consumer.persist(claim)).state).toBe('ready');
    expect(await consumer.complete(claim)).toBe(true);
  }
}

test('activity pages expose verified history and hold an upper watermark across later inserts', async () => {
  await changeStatus(id(401));
  await changeStatus(id(400));
  await changeStatus(id(402));
  const url = `/v1/tasks/${id(700)}/activity`;
  const first = await api().get(url).query({ limit: '2' }).set(headers.Alice);
  expect(first.status).toBe(200);
  expect(first.body.items).toHaveLength(2);
  expect(first.body.items.map((item) => item.payload.taskVersion)).toEqual([4, 3]);
  expect(first.body.items[0]).toMatchObject({
    actor: { id: id(101), name: 'Alice' },
    workspaceId: id(1),
    taskId: id(700),
    type: 'task.status_changed',
    payload: { beforeStatusId: id(400), afterStatusId: id(402) },
  });
  expect(Object.keys(first.body.items[0].actor).sort()).toEqual(['id', 'name']);
  const cursor = first.body.pageInfo.nextCursor;
  await changeStatus(id(401));
  const next = await api().get(url).query({ limit: '2', cursor }).set(headers.Alice);
  expect(next.status).toBe(200);
  expect(next.body.items.map((item) => item.payload.taskVersion)).toEqual([2]);
  expect(next.body.pageInfo).toEqual({ hasNextPage: false, nextCursor: null });
  expect(
    (await api().get(url).query({ limit: '2' }).set(headers.Alice)).body.items[0].payload
      .taskVersion,
  ).toBe(5);
  for (const [target, actor, query] of [
    [700, 'Bob', { limit: '2', cursor }],
    [701, 'Alice', { limit: '2', cursor }],
    [700, 'Alice', { limit: '3', cursor }],
    [700, 'Alice', { limit: '2', cursor: `${cursor}x` }],
  ]) {
    expect(
      (
        await api()
          .get(`/v1/tasks/${id(target)}/activity`)
          .query(query)
          .set(headers[actor])
      ).status,
    ).toBe(400);
  }
});

test('activity enforces live task access and cursor-only input', async () => {
  for (const [task, actor, status] of [
    [708, 'Bob', 403],
    [716, 'Bob', 403],
    [900, 'Alice', 404],
    [799, 'Alice', 404],
  ]) {
    expect(
      (
        await api()
          .get(`/v1/tasks/${id(task)}/activity`)
          .set(headers[actor])
      ).status,
    ).toBe(status);
  }
  expect((await api().get(`/v1/tasks/${id(700)}/activity`)).status).toBe(401);
  for (const query of [
    { page: '1' },
    { offset: '2' },
    { limit: '0' },
    { limit: '101' },
    { cursor: 'forged' },
  ]) {
    expect(
      (
        await api()
          .get(`/v1/tasks/${id(700)}/activity`)
          .query(query)
          .set(headers.Alice)
      ).status,
    ).toBe(400);
  }
  expect(
    (
      await api()
        .get(`/v1/tasks/${id(700)}/activity?limit=2&limit=3`)
        .set(headers.Alice)
    ).status,
  ).toBe(400);
});
