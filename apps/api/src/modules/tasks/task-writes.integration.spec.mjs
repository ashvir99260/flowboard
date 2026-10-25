import { setTimeout } from 'node:timers/promises';

import { createDatabase, DemoAccounts, DemoPassword, seedDemoData } from '@flowboard/database';
import { createLogger } from '@flowboard/logger';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin } from '../../../test/common/auth-fixtures.mjs';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let fixture;
let onTaskWrite;
const headers = {};
const api = () => request(fixture.app.getHttpServer());
beforeAll(async () => {
  fixture = await startTestApplication({
    auth: true,
    logger: createLogger({
      service: 'api',
      level: 'debug',
      write: (line) => {
        const event = JSON.parse(line);
        if (event.event === 'operation.started' && event.operation === 'tasks.write')
          onTaskWrite?.();
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
    headers[account.name] = { Authorization: `Bearer ${response.body.data.accessToken}` };
  }
});
afterAll(async () => fixture?.close());
const config = async () =>
  (
    await api()
      .get(`/v1/lists/${id(221)}/resolved-fields`)
      .set(headers.Alice)
  ).body.configVersion;

test('member can create, edit and archive a complete valid task with data-only revisions', async () => {
  const revision = await config();
  const created = await api()
    .post(`/v1/lists/${id(221)}/tasks`)
    .set(headers.Bob)
    .send({
      title: 'New task',
      statusId: id(400),
      customFields: { effort: 0 },
      expectedConfigVersion: revision,
    });
  expect(created.status).toBe(201);
  expect(created.body.data).toMatchObject({
    title: 'New task',
    description: '',
    priority: 'none',
    dueDate: null,
    assigneeIds: [],
    version: 1,
    customFields: { effort: 0 },
  });
  expect(created.body.configVersion).toBe(revision);
  const task = created.body.data;
  const updated = await api().patch(`/v1/tasks/${task.id}`).set(headers.Bob).send({
    title: 'Edited task',
    expectedVersion: task.version,
    expectedConfigVersion: revision,
  });
  expect(updated.status).toBe(200);
  expect(updated.body.data.version).toBe(2);
  expect(updated.body.configVersion).toBe(revision);
  expect(updated.body.dataVersion).toBe(created.body.dataVersion + 1);
  expect((await api().get(`/v1/tasks/${task.id}`).set(headers.Alice)).body.data).toEqual(
    updated.body.data,
  );
  const removed = await api()
    .delete(`/v1/tasks/${task.id}`)
    .set(headers.Bob)
    .send({ expectedVersion: 2, expectedConfigVersion: revision });
  expect(removed.status).toBe(204);
  expect((await api().get(`/v1/tasks/${task.id}`).set(headers.Bob)).status).toBe(404);
});

test('assignable member pages filter private-list visibility before pagination', async () => {
  const first = await api()
    .get(`/v1/workspaces/${id(1)}/members`)
    .query({ assignableToListId: id(222), limit: '1' })
    .set(headers.Alice);
  expect(first.status).toBe(200);
  expect(first.body.items).toHaveLength(1);
  expect(first.body.pageInfo.hasNextPage).toBe(true);
  const second = await api()
    .get(`/v1/workspaces/${id(1)}/members`)
    .query({ assignableToListId: id(222), limit: '1', cursor: first.body.pageInfo.nextCursor })
    .set(headers.Alice);
  expect(second.status).toBe(200);
  expect([...first.body.items, ...second.body.items].map((member) => member.userId).sort()).toEqual(
    [id(101), id(103)],
  );
  expect(second.body.pageInfo.hasNextPage).toBe(false);
});

const create = async (extra = {}, actor = 'Alice', list = 221) => {
  const expectedConfigVersion = await config();

  return api()
    .post(`/v1/lists/${id(list)}/tasks`)
    .set(headers[actor])
    .send({
      title: 'Validation task',
      statusId: id(400),
      customFields: { effort: 1 },
      expectedConfigVersion,
      ...extra,
    });
};

test('due instants roundtrip in UTC and an equivalent offset update is a no-op', async () => {
  const created = await create({ dueDate: '2026-11-30T08:00:00.123+05:30' });
  expect(created.status).toBe(201);
  expect(created.body.data.dueDate).toBe('2026-11-30T02:30:00.123Z');
  const read = await api().get(`/v1/tasks/${created.body.data.id}`).set(headers.Alice);
  expect(read.body.data.dueDate).toBe(created.body.data.dueDate);
  const unchanged = await api().patch(`/v1/tasks/${created.body.data.id}`).set(headers.Alice).send({
    dueDate: '2026-11-29T21:30:00.123-05:00',
    expectedVersion: created.body.data.version,
    expectedConfigVersion: created.body.configVersion,
  });
  expect(unchanged.status).toBe(200);
  expect(unchanged.body.data.version).toBe(created.body.data.version);
  expect(unchanged.body.dataVersion).toBe(created.body.dataVersion);
});

test.each([
  [{ title: 'x'.repeat(501) }, 400],
  [{ statusId: id(999) }, 400],
  [{ statusId: id(800) }, 400],
  [{ customFields: {} }, 400],
  [{ customFields: { effort: '1' } }, 400],
  [{ customFields: { effort: 1, team: id(612) } }, 400],
  [{ customFields: { effort: 1, unknown: true } }, 400],
  [{ dueDate: '2026-02-29T00:00:00.000Z' }, 400],
  [{ dueDate: '2026-11-30' }, 400],
  [{ dueDate: 'garbage' }, 400],
  [{ dueDate: '2026-13-11T00:00:00Z' }, 400],
  [{ dueDate: '2026-11-30T12:30:00' }, 400],
  [{ dueDate: '2026-11-30T12:30:00.1234Z' }, 400],
  [{ assigneeIds: [id(104)] }, 404],
  [{ assigneeIds: [id(102), id(102)] }, 400],
  [{ assigneeIds: Array.from({ length: 21 }, (_, index) => id(1000 + index)) }, 400],
  [{ workspaceId: id(2) }, 400],
  [{ position: 0 }, 400],
  [{ createdAt: '2026-01-01T00:00:00.000Z' }, 400],
])('invalid create %j rejects atomically with status %s', async (extra, status) => {
  const before = await api()
    .get(`/v1/lists/${id(221)}/tasks?limit=100`)
    .set(headers.Alice);
  const result = await create(extra);
  expect(result.status).toBe(status);
  expect(result.body.error).toBeDefined();
  const after = await api()
    .get(`/v1/lists/${id(221)}/tasks?limit=100`)
    .set(headers.Alice);
  expect(after.body).toEqual(before.body);
});

test('actor and assignee visibility cannot cross private or tenant boundaries', async () => {
  expect((await create({}, 'Bob', 222)).status).toBe(403);
  expect((await create({}, 'Dan')).status).toBe(404);
  expect((await create({ assigneeIds: [id(102)] }, 'Alice', 222)).status).toBe(403);
  expect((await create({ assigneeIds: [id(103)] }, 'Alice', 222)).status).toBe(201);
  const revision = await config();
  for (const [task, actor, status] of [
    [708, 'Bob', 403],
    [900, 'Alice', 404],
  ]) {
    expect(
      (
        await api()
          .patch(`/v1/tasks/${id(task)}`)
          .set(headers[actor])
          .send({ title: 'Denied', expectedVersion: 1, expectedConfigVersion: revision })
      ).status,
    ).toBe(status);
    expect(
      (
        await api()
          .delete(`/v1/tasks/${id(task)}`)
          .set(headers[actor])
          .send({ expectedVersion: 1, expectedConfigVersion: revision })
      ).status,
    ).toBe(status);
  }
});

test('complete edits preserve omissions, clear optional values and keep no-ops stable', async () => {
  const created = await create({
    assigneeIds: [id(102), id(101)],
    dueDate: '2026-11-30T00:00:00.000Z',
    customFields: { effort: 3, team: id(611), release_date: '2026-11-20' },
  });
  expect(created.status).toBe(201);
  const task = created.body.data;
  const patch = {
    description: '## Updated',
    priority: 'urgent',
    statusId: id(401),
    dueDate: null,
    assigneeIds: [],
    customFields: { effort: 0, release_date: null, team: null },
    expectedVersion: 1,
    expectedConfigVersion: created.body.configVersion,
  };
  const updated = await api().patch(`/v1/tasks/${task.id}`).set(headers.Bob).send(patch);
  expect(updated.status).toBe(200);
  expect(updated.body.data).toMatchObject({
    title: task.title,
    description: '## Updated',
    priority: 'urgent',
    dueDate: null,
    assigneeIds: [],
    customFields: { effort: 0 },
    version: 2,
  });
  expect(updated.body.dataVersion).toBe(created.body.dataVersion + 1);
  expect(updated.body.configVersion).toBe(created.body.configVersion);
  expect(updated.body.changedTaskIds).toEqual([task.id]);
  const noop = await api()
    .patch(`/v1/tasks/${task.id}`)
    .set(headers.Bob)
    .send({ ...patch, expectedVersion: 2 });
  expect(noop.status).toBe(200);
  expect(noop.body).toEqual({ ...updated.body, changedTaskIds: [] });
  const bad = await api()
    .patch(`/v1/tasks/${task.id}`)
    .set(headers.Bob)
    .send({
      customFields: { effort: null },
      expectedVersion: 2,
      expectedConfigVersion: updated.body.configVersion,
    });
  expect(bad.status).toBe(400);
  expect(bad.body.error.details[0].path).toEqual(['customFields', 'effort']);
  for (const change of [
    { expectedVersion: 1 },
    { expectedConfigVersion: updated.body.configVersion + 1 },
  ])
    expect(
      (
        await api()
          .patch(`/v1/tasks/${task.id}`)
          .set(headers.Bob)
          .send({
            title: 'Stale',
            expectedVersion: 2,
            expectedConfigVersion: updated.body.configVersion,
            ...change,
          })
      ).status,
    ).toBe(409);
  expect((await api().get(`/v1/tasks/${task.id}`).set(headers.Bob)).body.data).toEqual(
    updated.body.data,
  );
});

test('concurrent edits serialize and data-only writes invalidate existing task cursors', async () => {
  const page = await api()
    .get(`/v1/lists/${id(221)}/tasks?limit=1`)
    .set(headers.Alice);
  const created = await create();
  expect(created.status).toBe(201);
  expect(created.body.configVersion).toBe(page.body.configVersion);
  expect(
    (
      await api()
        .get(`/v1/lists/${id(221)}/tasks`)
        .query({ limit: '1', cursor: page.body.pageInfo.nextCursor })
        .set(headers.Alice)
    ).status,
  ).toBe(409);
  const responses = await Promise.all(
    ['A', 'B'].map((title) =>
      api()
        .patch(`/v1/tasks/${created.body.data.id}`)
        .set(headers.Bob)
        .send({ title, expectedVersion: 1, expectedConfigVersion: created.body.configVersion }),
    ),
  );
  expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
  const current = await api().get(`/v1/tasks/${created.body.data.id}`).set(headers.Alice);
  expect(current.body.data.version).toBe(2);
  expect(current.body.dataVersion).toBe(created.body.dataVersion + 1);
});

test('member cursors bind assignment scope and denied lists cannot reveal candidates', async () => {
  const page = await api()
    .get(`/v1/workspaces/${id(1)}/members`)
    .query({ limit: '1', assignableToListId: id(222) })
    .set(headers.Alice);
  for (const query of [{ limit: '1' }, { limit: '1', assignableToListId: id(221) }])
    expect(
      (
        await api()
          .get(`/v1/workspaces/${id(1)}/members`)
          .query({ ...query, cursor: page.body.pageInfo.nextCursor })
          .set(headers.Alice)
      ).status,
    ).toBe(400);
  expect(
    (
      await api()
        .get(`/v1/workspaces/${id(1)}/members`)
        .query({ assignableToListId: id(222) })
        .set(headers.Bob)
    ).status,
  ).toBe(403);
  expect(
    (
      await api()
        .get('/v1/workspaces')
        .query({ assignableToListId: id(221) })
        .set(headers.Alice)
    ).status,
  ).toBe(400);
});

test('create accepts required zero and false through the real list schema', async () => {
  const expectedConfigVersion = await config();
  const list = await api()
    .post('/v1/nodes')
    .set(headers.Alice)
    .send({
      type: 'list',
      name: 'Required test',
      parentId: id(211),
      visibility: 'public',
      expectedConfigVersion,
    });
  expect(list.status).toBe(201);
  const field = await api()
    .post(`/v1/scopes/list/${list.body.data.id}/fields`)
    .set(headers.Alice)
    .send({
      key: 'approved',
      name: 'Approved',
      type: 'checkbox',
      required: true,
      options: [],
      position: 0,
      expectedConfigVersion: list.body.configVersion,
    });
  expect(field.status).toBe(201);
  const result = await api()
    .post(`/v1/lists/${list.body.data.id}/tasks`)
    .set(headers.Bob)
    .send({
      title: 'Zero and false',
      statusId: id(400),
      customFields: { approved: false, effort: 0 },
      expectedConfigVersion: field.body.configVersion,
    });
  expect(result.status).toBe(201);
  expect(result.body.data.customFields).toEqual({ approved: false, effort: 0 });
});

test('retained assignees are revalidated after access revocation and can be removed', async () => {
  const created = await create({ assigneeIds: [id(102)] });
  expect(created.status).toBe(201);
  const denied = await api()
    .put(`/v1/nodes/${id(221)}/grants`)
    .set(headers.Alice)
    .send({ userId: id(102), mode: 'deny', expectedConfigVersion: created.body.configVersion });
  expect(denied.status).toBe(200);
  try {
    const input = {
      title: 'Updated after revocation',
      expectedVersion: 1,
      expectedConfigVersion: denied.body.configVersion,
    };
    expect(
      (await api().patch(`/v1/tasks/${created.body.data.id}`).set(headers.Alice).send(input))
        .status,
    ).toBe(403);
    const repaired = await api()
      .patch(`/v1/tasks/${created.body.data.id}`)
      .set(headers.Alice)
      .send({ ...input, assigneeIds: [] });
    expect(repaired.status).toBe(200);
    expect(repaired.body.data.assigneeIds).toEqual([]);
    expect(repaired.body.data.version).toBe(2);
  } finally {
    const revision = await config();
    expect(
      (
        await api()
          .delete(`/v1/nodes/${id(221)}/grants/${id(102)}`)
          .set(headers.Alice)
          .send({ expectedConfigVersion: revision })
      ).status,
    ).toBe(204);
  }
});

test('queued writes recheck configuration and actor access after acquiring the lock', async () => {
  const database = createDatabase(fixture.infrastructure.databaseUrl);
  const context = { actorUserId: id(101), workspaceId: id(1) };
  async function ready(promise, label) {
    const timeout = new AbortController();
    try {
      await Promise.race([
        promise,
        setTimeout(5000, undefined, { signal: timeout.signal }).then(() => {
          throw new Error(label);
        }),
      ]);
    } finally {
      timeout.abort();
    }
  }
  try {
    for (const [target, role, list, status] of [
      [103, 'admin', 221, 409],
      [101, 'member', 222, 403],
    ]) {
      const revision = await config();
      let signal, release;
      const locked = new Promise((resolve) => {
        signal = resolve;
      });
      const finish = new Promise((resolve) => {
        release = resolve;
      });
      const transaction = database.write(context, async (store) => {
        await store.memberships.update(id(target), { role, expectedConfigVersion: revision });
        signal();
        await finish;
      });
      let pending;
      try {
        await ready(
          Promise.race([
            locked,
            transaction.then(() => {
              throw new Error('Lock completed early');
            }),
          ]),
          'Lock did not become ready',
        );
        const began = new Promise((resolve) => {
          onTaskWrite = resolve;
        });
        pending = api()
          .post(`/v1/lists/${id(list)}/tasks`)
          .set(headers.Alice)
          .send({
            title: 'Rejected queued write',
            statusId: id(400),
            customFields: { effort: 1 },
            expectedConfigVersion: revision,
          })
          .timeout({ deadline: 8000, response: 6000 })
          .then((response) => response);
        await ready(began, 'Task writer did not reach transaction boundary');
        release();
        await transaction;
        const response = await pending;
        expect(response.status).toBe(status);
        const tasks = await api()
          .get(`/v1/lists/${id(list)}/tasks?limit=100`)
          .set(headers.Carol);
        expect(tasks.status).toBe(200);
        expect(tasks.body.items.some((task) => task.title === 'Rejected queued write')).toBe(false);
      } finally {
        onTaskWrite = undefined;
        release();
        await Promise.allSettled([transaction, pending].filter(Boolean));
      }
    }
  } finally {
    await database.close();
  }
});

test('assignee validation paths point to the original request order', async () => {
  const result = await create({ assigneeIds: [id(102), id(101)] }, 'Carol', 222);
  expect(result.status).toBe(403);
  expect(result.body.error.details[0].path).toEqual(['assigneeIds', 0]);
  const created = await create({}, 'Carol', 222);
  expect(created.status).toBe(201);
  const updated = await api()
    .patch(`/v1/tasks/${created.body.data.id}`)
    .set(headers.Carol)
    .send({
      assigneeIds: [id(102), id(101)],
      expectedVersion: 1,
      expectedConfigVersion: created.body.configVersion,
    });
  expect(updated.status).toBe(403);
  expect(updated.body.error.details[0].path).toEqual(['assigneeIds', 0]);
});
