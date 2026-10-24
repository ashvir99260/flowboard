import { setTimeout } from 'node:timers/promises';

import { createDatabase, DemoAccounts, DemoPassword, seedDemoData } from '@flowboard/database';
import { createLogger } from '@flowboard/logger';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin } from '../../../test/common/auth-fixtures.mjs';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let fixture;
let onHierarchyWrite;
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
        if (event.event === 'operation.started' && event.operation === 'hierarchy.write')
          onHierarchyWrite?.();
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
const config = async () => (await api().get('/v1/tree').set(headers.Alice)).body.configVersion;
async function node(type, parentId, name = 'Move container', visibility = 'public') {
  const expectedConfigVersion = await config();
  const response = await api()
    .post('/v1/nodes')
    .set(headers.Alice)
    .send({ type, parentId, name, visibility, expectedConfigVersion });
  expect(response.status).toBe(201);

  return response.body;
}

test('administrator can reparent an empty list to a valid folder atomically', async () => {
  const list = await node('list', id(211));
  const moved = await api()
    .post(`/v1/nodes/${list.data.id}/move`)
    .set(headers.Alice)
    .send({
      parentId: id(212),
      placement: { edge: 'start' },
      expectedVersion: list.data.version,
      expectedConfigVersion: list.configVersion,
    });
  expect(moved.status).toBe(200);
  expect(moved.body.data).toMatchObject({
    id: list.data.id,
    parentId: id(212),
    position: 0,
    version: 2,
  });
  expect(moved.body.configVersion).toBe(list.configVersion + 1);
  expect(moved.body.dataVersion).toBe(list.dataVersion + 1);
});

async function move(container, parentId, extra = {}, actor = 'Alice') {
  const expectedConfigVersion = await config();

  return api()
    .post(`/v1/nodes/${container.data.id}/move`)
    .set(headers[actor])
    .send({
      parentId,
      placement: { edge: 'end' },
      expectedVersion: container.data.version,
      expectedConfigVersion,
      ...extra,
    });
}
async function task(listId, extra = {}) {
  const expectedConfigVersion = await config();
  const response = await api()
    .post(`/v1/lists/${listId}/tasks`)
    .set(headers.Alice)
    .send({
      title: 'Container move task',
      statusId: id(400),
      customFields: { effort: 1 },
      expectedConfigVersion,
      ...extra,
    });
  expect(response.status).toBe(201);

  return response.body;
}
const get = async (idValue) => {
  const result = await api().get(`/v1/nodes/${idValue}`).set(headers.Alice);
  expect(result.status).toBe(200);

  return result.body;
};

test('folder moves preserve descendant task data and node audits except changed siblings', async () => {
  const folder = await node('folder', id(201));
  const first = await node('list', folder.data.id, 'First'),
    second = await node('list', folder.data.id, 'Second');
  const created = await task(first.data.id);
  const result = await move(folder, id(202));
  expect(result.status).toBe(200);
  expect(result.body.data.parentId).toBe(id(202));
  const after = await api().get(`/v1/tasks/${created.data.id}`).set(headers.Alice);
  expect(after.status).toBe(200);
  expect(after.body.data).toEqual(created.data);
  expect((await get(first.data.id)).data).toEqual(first.data);
  expect((await get(second.data.id)).data).toEqual(second.data);
  const replay = await move(result.body, id(202));
  expect(replay.status).toBe(200);
  expect(replay.body).toEqual(result.body);
});

test.each([
  ['space', null, 202, 400],
  ['folder', 201, 212, 400],
  ['list', 211, 201, 400],
  ['list', 211, 311, 404],
  ['list', 211, 999, 404],
])('%s rejects invalid parent %s/%s with %s', async (type, parent, target, status) => {
  const source = await node(type, parent === null ? null : id(parent));
  const before = await get(source.data.id);
  const result = await move(source, id(target));
  expect(result.status).toBe(status);
  expect(await get(source.data.id)).toEqual(before);
});

test('self, descendant, malformed, foreign and wrong-parent anchors are rejected', async () => {
  const source = await node('folder', id(201));
  const child = await node('list', source.data.id);
  const before = await get(source.data.id);
  for (const [parent, extra, status] of [
    [source.data.id, {}, 400],
    [child.data.id, {}, 400],
    [id(202), { placement: { beforeId: source.data.id } }, 400],
    [id(202), { placement: { beforeId: id(311) } }, 404],
    [id(202), { placement: { beforeId: id(211) } }, 400],
    [id(202), { position: 0 }, 400],
    [id(202), { workspaceId: id(2) }, 400],
    [null, {}, 400],
  ]) {
    expect((await move(source, parent, extra)).status).toBe(status);
    expect(await get(source.data.id)).toEqual(before);
  }
});

test('live status and source-only field inheritance cannot be silently remapped', async () => {
  const revision = await config();
  const hidden = await api()
    .post(`/v1/scopes/folder/${id(212)}/statuses`)
    .set(headers.Alice)
    .send({ kind: 'override', statusId: id(403), hidden: true, expectedConfigVersion: revision });
  expect(hidden.status).toBe(201);
  const source = await node('list', id(211));
  const closed = await task(source.data.id, { statusId: id(403) });
  let before = await get(source.data.id);
  let failed = await move(source, id(212));
  expect(failed.status).toBe(409);
  expect(failed.body.error.code).toBe('STATUS_IN_USE');
  expect(await get(source.data.id)).toEqual(before);
  const patched = await api()
    .patch(`/v1/tasks/${closed.data.id}`)
    .set(headers.Alice)
    .send({
      statusId: id(400),
      customFields: { team: id(610) },
      expectedVersion: 1,
      expectedConfigVersion: before.configVersion,
    });
  expect(patched.status).toBe(200);
  before = await get(source.data.id);
  failed = await move(source, id(212));
  expect(failed.status).toBe(409);
  expect(failed.body.error.code).toBe('CONFIG_INVALIDATES_TASKS');
  expect(await get(source.data.id)).toEqual(before);
  const cleared = await api()
    .patch(`/v1/tasks/${closed.data.id}`)
    .set(headers.Alice)
    .send({
      customFields: { team: null },
      expectedVersion: patched.body.data.version,
      expectedConfigVersion: before.configVersion,
    });
  expect(cleared.status).toBe(200);
  const accepted = await move(source, id(212));
  expect(accepted.status).toBe(200);
  expect((await api().get(`/v1/tasks/${closed.data.id}`).set(headers.Alice)).body.data).toEqual(
    cleared.body.data,
  );
});

test('empty moved scopes are validated when their partial status override loses its ancestor', async () => {
  const folder = await node('folder', id(201));
  let revision = await config();
  const definition = await api()
    .post(`/v1/scopes/space/${id(201)}/statuses`)
    .set(headers.Alice)
    .send({
      kind: 'define',
      key: 'move_empty',
      category: 'active',
      name: 'Inherited',
      color: '#123456',
      position: 9,
      expectedConfigVersion: revision,
    });
  expect(definition.status).toBe(201);
  revision = definition.body.configVersion;
  const override = await api()
    .post(`/v1/scopes/folder/${folder.data.id}/statuses`)
    .set(headers.Alice)
    .send({
      kind: 'override',
      statusId: definition.body.data.identity.id,
      name: 'Local title',
      expectedConfigVersion: revision,
    });
  expect(override.status).toBe(201);
  const before = await get(folder.data.id),
    result = await move(folder, id(202));
  expect(result.status).toBe(409);
  expect(result.body.error.code).toBe('CONFIG_INVALIDATES_TASKS');
  expect(await get(folder.data.id)).toEqual(before);
});

test('required destination fields and incompatible options block a move', async () => {
  const destination = await node('folder', id(202));
  const source = await node('list', id(211));
  await task(source.data.id);
  const revision = await config();
  const field = await api()
    .post(`/v1/scopes/folder/${destination.data.id}/fields`)
    .set(headers.Alice)
    .send({
      key: 'approved',
      name: 'Approved',
      type: 'checkbox',
      required: true,
      options: [],
      position: 0,
      expectedConfigVersion: revision,
    });
  expect(field.status).toBe(201);
  const before = await get(source.data.id),
    failed = await move(source, destination.data.id);
  expect(failed.status).toBe(409);
  expect(failed.body.error.details.some((issue) => issue.path.includes('approved'))).toBe(true);
  expect(await get(source.data.id)).toEqual(before);
});

test('a new private ancestor cannot strand assigned members; visibility follows the new path', async () => {
  const destination = await node('folder', id(202), 'Private destination', 'private');
  const source = await node('list', id(211));
  const created = await task(source.data.id, { assigneeIds: [id(102)] });
  let revision = await config();
  const allow = await api()
    .put(`/v1/nodes/${destination.data.id}/grants`)
    .set(headers.Alice)
    .send({ userId: id(103), mode: 'allow', expectedConfigVersion: revision });
  expect(allow.status).toBe(200);
  revision = allow.body.configVersion;
  const before = await get(source.data.id);
  const failed = await move(source, destination.data.id);
  expect(failed.status).toBe(409);
  expect(failed.body.error.code).toBe('CONFIG_INVALIDATES_TASKS');
  expect(await get(source.data.id)).toEqual(before);
  const assigned = await api()
    .patch(`/v1/tasks/${created.data.id}`)
    .set(headers.Alice)
    .send({ assigneeIds: [id(103)], expectedVersion: 1, expectedConfigVersion: revision });
  expect(assigned.status).toBe(200);
  const accepted = await move(source, destination.data.id);
  expect(accepted.status).toBe(200);
  expect((await api().get(`/v1/nodes/${source.data.id}`).set(headers.Bob)).status).toBe(403);
  expect((await api().get(`/v1/nodes/${source.data.id}`).set(headers.Carol)).status).toBe(200);
  const bobTree = await api().get('/v1/tree?limit=100').set(headers.Bob);
  expect(bobTree.status).toBe(200);
  expect(bobTree.body.items.some((item) => item.id === source.data.id)).toBe(false);
});

test('archived parents and anchors reject, and archived tasks do not constrain reparenting', async () => {
  const destination = await node('folder', id(202));
  const source = await node('list', id(211));
  const created = await task(source.data.id, { statusId: id(403) });
  let revision = await config();
  expect(
    (
      await api()
        .delete(`/v1/tasks/${created.data.id}`)
        .set(headers.Alice)
        .send({ expectedVersion: 1, expectedConfigVersion: revision })
    ).status,
  ).toBe(204);
  expect((await move(source, id(212))).status).toBe(200);
  const fresh = await get(source.data.id);
  revision = await config();
  expect(
    (
      await api()
        .delete(`/v1/nodes/${destination.data.id}`)
        .set(headers.Alice)
        .send({ expectedVersion: 1, expectedConfigVersion: revision })
    ).status,
  ).toBe(204);
  expect((await move(fresh, destination.data.id)).status).toBe(404);
});

test('members, stale node/config revisions and anonymous clients cannot reparent', async () => {
  const source = await node('list', id(211));
  expect((await move(source, id(212), {}, 'Bob')).status).toBe(403);
  expect((await move(source, id(212), { expectedVersion: 99 })).status).toBe(409);
  expect((await move(source, id(212), { expectedConfigVersion: 999 })).status).toBe(409);
  const revision = await config();
  expect(
    (
      await api()
        .post(`/v1/nodes/${source.data.id}/move`)
        .send({
          parentId: id(212),
          placement: { edge: 'start' },
          expectedVersion: 1,
          expectedConfigVersion: revision,
        })
    ).status,
  ).toBe(401);
});

test('destination select options are validated without dropping existing values', async () => {
  const destination = await node('folder', id(202));
  const source = await node('list', id(211));
  const created = await task(source.data.id, { customFields: { effort: 1, team: id(610) } });
  const revision = await config();
  const field = await api()
    .post(`/v1/scopes/folder/${destination.data.id}/fields`)
    .set(headers.Alice)
    .send({
      key: 'team',
      name: 'Team',
      type: 'single_select',
      required: false,
      position: 0,
      options: [{ id: id(9910), label: 'Different', color: '#123456' }],
      expectedConfigVersion: revision,
    });
  expect(field.status).toBe(201);
  const before = await get(source.data.id),
    result = await move(source, destination.data.id);
  expect(result.status).toBe(409);
  expect(result.body.error.details.some((issue) => issue.path.includes('team'))).toBe(true);
  expect(await get(source.data.id)).toEqual(before);
  expect((await api().get(`/v1/tasks/${created.data.id}`).set(headers.Alice)).body.data).toEqual(
    created.data,
  );
});

test('destination ancestor deny rules reject retained assignees and take effect after a valid move', async () => {
  const destination = await node('folder', id(202));
  const source = await node('list', id(211));
  await task(source.data.id, { assigneeIds: [id(102)] });
  const revision = await config();
  const deny = await api()
    .put(`/v1/nodes/${destination.data.id}/grants`)
    .set(headers.Alice)
    .send({ userId: id(102), mode: 'deny', expectedConfigVersion: revision });
  expect(deny.status).toBe(200);
  expect((await move(source, destination.data.id)).status).toBe(409);
  const latest = await config();
  expect(
    (
      await api()
        .delete(`/v1/nodes/${destination.data.id}/grants/${id(102)}`)
        .set(headers.Alice)
        .send({ expectedConfigVersion: latest })
    ).status,
  ).toBe(204);
  expect((await move(source, destination.data.id)).status).toBe(200);
  expect((await api().get(`/v1/nodes/${source.data.id}`).set(headers.Bob)).status).toBe(200);
});

test('moves invalidate existing tree cursors and cannot cross source tenants', async () => {
  const source = await node('list', id(211));
  const tree = await api().get('/v1/tree?limit=1').set(headers.Alice);
  expect(tree.status).toBe(200);
  expect((await move(source, id(212), {}, 'Dan')).status).toBe(404);
  const moved = await move(source, id(212));
  expect(moved.status).toBe(200);
  const stale = await api()
    .get('/v1/tree')
    .query({ limit: '1', cursor: tree.body.pageInfo.nextCursor })
    .set(headers.Alice);
  expect(stale.status).toBe(409);
  expect(stale.body.error.code).toBe('CURSOR_STALE');
});

test('queued container moves recheck configuration and administrator role after acquiring the lock', async () => {
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
    for (const [target, role, status] of [
      [103, 'admin', 409],
      [101, 'member', 403],
    ]) {
      const created = await node('list', id(211));
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
          onHierarchyWrite = resolve;
        });
        pending = api()
          .post(`/v1/nodes/${created.data.id}/move`)
          .set(headers.Alice)
          .send({
            parentId: id(212),
            placement: { edge: 'end' },
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
        expect((await get(created.data.id)).data).toEqual(created.data);
      } finally {
        onHierarchyWrite = undefined;
        release();
        await Promise.allSettled([transaction, pending].filter(Boolean));
      }
    }
  } finally {
    await database.close();
  }
});
