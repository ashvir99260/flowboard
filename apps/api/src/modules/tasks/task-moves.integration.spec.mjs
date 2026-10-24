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
const task = async (taskId) =>
  (await api().get(`/v1/tasks/${taskId}`).set(headers.Alice)).body.data;
const create = async (extra = {}, listId = id(221)) => {
  const revision = await config();
  const response = await api()
    .post(`/v1/lists/${listId}/tasks`)
    .set(headers.Alice)
    .send({
      title: 'Move test',
      statusId: id(400),
      customFields: { effort: 1 },
      expectedConfigVersion: revision,
      ...extra,
    });
  expect(response.status).toBe(201);

  return response.body;
};

test('move preserves available status and reorder returns persisted dense positions', async () => {
  const created = await create();
  const moved = await api()
    .post(`/v1/tasks/${created.data.id}/move`)
    .set(headers.Alice)
    .send({
      destinationListId: id(223),
      placement: { edge: 'start' },
      expectedVersion: 1,
      expectedConfigVersion: created.configVersion,
    });
  expect(moved.status).toBe(200);
  expect(moved.body.data).toMatchObject({
    primaryListId: id(223),
    statusId: id(400),
    position: 0,
    version: 2,
  });
  expect(moved.body.configVersion).toBe(created.configVersion);
  expect(moved.body.dataVersion).toBe(created.dataVersion + 1);
  const reordered = await api()
    .post(`/v1/tasks/${created.data.id}/reorder`)
    .set(headers.Alice)
    .send({
      placement: { edge: 'end' },
      expectedVersion: 2,
      expectedConfigVersion: created.configVersion,
    });
  expect(reordered.status).toBe(200);
  expect(await task(created.data.id)).toEqual(reordered.body.data);
});

const move = async (taskId, body, actor = 'Alice') =>
  api().post(`/v1/tasks/${taskId}/move`).set(headers[actor]).send(body);
const reorder = async (taskId, body, actor = 'Alice') =>
  api().post(`/v1/tasks/${taskId}/reorder`).set(headers[actor]).send(body);
async function newList(name, parent = 211) {
  const revision = await config();
  const result = await api()
    .post('/v1/nodes')
    .set(headers.Alice)
    .send({ type: 'list', name, parentId: id(parent), expectedConfigVersion: revision });
  expect(result.status).toBe(201);

  return result.body.data.id;
}
const command = (created, extra = {}) => ({
  destinationListId: id(223),
  placement: { edge: 'end' },
  expectedVersion: created.data.version,
  expectedConfigVersion: created.configVersion,
  ...extra,
});

test('moves use category fallback and reject absent closed while allowing an explicit destination choice', async () => {
  const revision = await config();
  const status = await api()
    .post(`/v1/scopes/list/${id(221)}/statuses`)
    .set(headers.Alice)
    .send({
      kind: 'define',
      key: 'review_move',
      name: 'Review',
      category: 'active',
      color: '#123456',
      position: 9,
      expectedConfigVersion: revision,
    });
  expect(status.status).toBe(201);
  const source = await create({ statusId: status.body.data.identity.id });
  const mapped = await move(source.data.id, command(source));
  expect(mapped.status).toBe(200);
  expect(mapped.body.data.statusId).toBe(id(401));
  const closed = await create({ statusId: id(403) });
  const failed = await move(closed.data.id, command(closed));
  expect(failed.status).toBe(400);
  expect(failed.body.error.code).toBe('STATUS_NOT_AVAILABLE');
  expect(await task(closed.data.id)).toEqual(closed.data);
  const chosen = await move(closed.data.id, command(closed, { statusId: id(402) }));
  expect(chosen.status).toBe(200);
  expect(chosen.body.data.statusId).toBe(id(402));
});

test('destination fields require explicit source-only clears and required values', async () => {
  const destination = await newList('Move required destination', 212);
  const revision = await config();
  const field = await api().post(`/v1/scopes/list/${destination}/fields`).set(headers.Alice).send({
    key: 'approved',
    name: 'Approved',
    type: 'checkbox',
    required: true,
    options: [],
    position: 0,
    expectedConfigVersion: revision,
  });
  expect(field.status).toBe(201);
  const created = await create({
    customFields: { effort: 0, team: id(610), release_date: '2026-11-20' },
  });
  const input = command(created, { destinationListId: destination });
  const missing = await move(created.data.id, {
    ...input,
    customFields: { release_date: null, team: null },
  });
  expect(missing.status).toBe(400);
  expect(missing.body.error.details).toContainEqual(
    expect.objectContaining({ path: ['customFields', 'approved'] }),
  );
  for (const customFields of [
    undefined,
    { approved: false },
    { approved: false, team: null },
    { approved: 'false', release_date: null, team: null },
  ]) {
    const response = await move(created.data.id, {
      ...input,
      ...(customFields ? { customFields } : {}),
    });
    expect(response.status).toBe(400);
    expect(response.body.error.details[0].path[0]).toBe('customFields');
    expect(await task(created.data.id)).toEqual(created.data);
  }
  const moved = await move(created.data.id, {
    ...input,
    customFields: { approved: false, release_date: null, team: null },
  });
  expect(moved.status).toBe(200);
  expect(moved.body.data.customFields).toEqual({ approved: false, effort: 0 });
});

test('destination select options and retained assignees are revalidated', async () => {
  const selected = await create({ customFields: { effort: 1, team: id(610) } });
  expect(
    (await move(selected.data.id, command(selected, { destinationListId: id(222) }))).status,
  ).toBe(400);
  const fixed = await move(
    selected.data.id,
    command(selected, { destinationListId: id(222), customFields: { team: id(612) } }),
  );
  expect(fixed.status).toBe(200);
  const assigned = await create({ assigneeIds: [id(102)] });
  expect(
    (await move(assigned.data.id, command(assigned, { destinationListId: id(222) }))).status,
  ).toBe(403);
  expect(await task(assigned.data.id)).toEqual(assigned.data);
});

test.each([
  [{ destinationListId: id(222) }, 'Bob', 403],
  [{ destinationListId: id(321) }, 'Alice', 404],
  [{ destinationListId: id(211) }, 'Alice', 404],
  [{ statusId: id(999) }, 'Alice', 400],
  [{ placement: { beforeId: id(708) } }, 'Alice', 400],
  [{ placement: { beforeId: id(708) } }, 'Bob', 403],
  [{ placement: { beforeId: id(900) } }, 'Alice', 404],
  [{ placement: { beforeId: id(717) } }, 'Alice', 400],
  [{ placement: { edge: 'start', afterId: id(700) } }, 'Alice', 400],
  [{ workspaceId: id(2) }, 'Alice', 400],
  [{ assigneeIds: [] }, 'Alice', 400],
])('invalid move %j by %s is atomic with %s', async (extra, actor, status) => {
  const created = await create();
  const response = await move(created.data.id, command(created, extra), actor);
  expect(response.status).toBe(status);
  expect(await task(created.data.id)).toEqual(created.data);
});

test('reorder supports every placement, no-ops, stale versions and self anchors', async () => {
  const list = await newList('Ordering test');
  const a = await create({}, list),
    b = await create({}, list),
    c = await create({}, list);
  let current = c;
  for (const placement of [
    { edge: 'start' },
    { afterId: a.data.id },
    { beforeId: a.data.id },
    { edge: 'end' },
  ]) {
    const result = await reorder(c.data.id, {
      placement,
      expectedVersion: current.data.version,
      expectedConfigVersion: c.configVersion,
    });
    expect(result.status).toBe(200);
    current = result.body;
    const page = await api().get(`/v1/lists/${list}/tasks`).set(headers.Alice);
    expect(page.body.items.map((row) => row.position)).toEqual([0, 1, 2]);
  }
  const noop = await reorder(c.data.id, {
    placement: { edge: 'end' },
    expectedVersion: current.data.version,
    expectedConfigVersion: c.configVersion,
  });
  expect(noop.status).toBe(200);
  expect(noop.body).toEqual({ ...current, changedTaskIds: [] });
  expect(
    (
      await reorder(c.data.id, {
        placement: { beforeId: c.data.id },
        expectedVersion: current.data.version,
        expectedConfigVersion: c.configVersion,
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await reorder(c.data.id, {
        placement: { edge: 'start' },
        expectedVersion: 1,
        expectedConfigVersion: c.configVersion,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await reorder(c.data.id, {
        placement: { edge: 'start' },
        expectedVersion: current.data.version,
        expectedConfigVersion: c.configVersion + 1,
      })
    ).status,
  ).toBe(409);
  expect(a.data.id).not.toBe(b.data.id);
});

test('same-task races conflict and successful moves invalidate both list cursors', async () => {
  const created = await create();
  const pages = await Promise.all(
    [221, 223].map((list) =>
      api()
        .get(`/v1/lists/${id(list)}/tasks?limit=1`)
        .set(headers.Alice),
    ),
  );
  const results = await Promise.all(
    ['start', 'end'].map((edge) =>
      move(created.data.id, command(created, { placement: { edge } })),
    ),
  );
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  for (const [index, list] of [221, 223].entries()) {
    const page = await api()
      .get(`/v1/lists/${id(list)}/tasks`)
      .query({ limit: '1', cursor: pages[index].body.pageInfo.nextCursor })
      .set(headers.Alice);
    expect(page.status).toBe(409);
  }
});

test('same-list moves can change status and use an exact column anchor', async () => {
  const created = await create();
  const result = await move(
    created.data.id,
    command(created, {
      destinationListId: id(221),
      statusId: id(401),
      placement: { beforeId: id(701) },
    }),
    'Carol',
  );
  expect(result.status).toBe(200);
  expect(result.body.data.statusId).toBe(id(401));
  const page = await api()
    .get(`/v1/lists/${id(221)}/tasks`)
    .query({ statusId: id(401) })
    .set(headers.Carol);
  const ids = page.body.items.map((item) => item.id);
  expect(ids.indexOf(created.data.id) + 1).toBe(ids.indexOf(id(701)));
});

test('archived anchors, forbidden sources and unauthenticated requests fail without moving', async () => {
  const created = await create();
  const anchor = await create();
  const archived = await api()
    .delete(`/v1/tasks/${anchor.data.id}`)
    .set(headers.Alice)
    .send({ expectedVersion: 1, expectedConfigVersion: anchor.configVersion });
  expect(archived.status).toBe(204);
  expect(
    (await move(created.data.id, command(created, { placement: { beforeId: anchor.data.id } })))
      .status,
  ).toBe(404);
  expect((await move(id(708), command(created), 'Bob')).status).toBe(403);
  expect((await move(id(900), command(created))).status).toBe(404);
  expect(
    (await api().post(`/v1/tasks/${created.data.id}/move`).send(command(created))).status,
  ).toBe(401);
  expect(
    (
      await api()
        .post(`/v1/tasks/${created.data.id}/reorder?offset=0`)
        .set(headers.Alice)
        .send({
          placement: { edge: 'start' },
          expectedVersion: 1,
          expectedConfigVersion: created.configVersion,
        })
    ).status,
  ).toBe(400);
  expect(await task(created.data.id)).toEqual(created.data);
});

test('queued moves recheck configuration and destination access after acquiring the lock', async () => {
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
      const created = await create();
      const revision = created.configVersion;
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
          .post(`/v1/tasks/${created.data.id}/move`)
          .set(headers.Alice)
          .send({
            destinationListId: id(list),
            placement: { edge: 'start' },
            expectedVersion: 1,
            expectedConfigVersion: revision,
          })
          .timeout({ deadline: 8000, response: 6000 })
          .then((response) => response);
        await ready(began, 'Task writer did not reach transaction boundary');
        release();
        await transaction;
        const response = await pending;
        expect(response.status).toBe(status);
        expect(await task(created.data.id)).toEqual(created.data);
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
