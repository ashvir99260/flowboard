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

test('sibling lists resolve different status sets and local configuration stays admin-only', async () => {
  const general = await api()
    .get(`/v1/lists/${id(221)}/resolved-statuses`)
    .set(headers.Bob);
  expect(general.status).toBe(200);
  expect(general.body.items.map((status) => status.key)).toEqual([
    'todo',
    'doing',
    'done',
    'closed',
  ]);
  const privateList = await api()
    .get(`/v1/lists/${id(222)}/resolved-statuses`)
    .set(headers.Alice);
  expect(privateList.status).toBe(200);
  expect(privateList.body.items.map((status) => status.key)).toEqual([
    'todo',
    'doing',
    'blocked',
    'done',
    'closed',
  ]);
  expect(privateList.body.items.find((status) => status.key === 'doing')).toMatchObject({
    id: id(401),
    name: 'In review',
    isInherited: true,
    isLocal: true,
  });
  expect(
    (
      await api()
        .get(`/v1/lists/${id(222)}/resolved-statuses`)
        .set(headers.Bob)
    ).status,
  ).toBe(403);
  expect(
    (
      await api()
        .get(`/v1/lists/${id(221)}/resolved-statuses`)
        .set(headers.Dan)
    ).status,
  ).toBe(404);
  const workspace = await api()
    .get(`/v1/scopes/workspace/${id(1)}/statuses`)
    .set(headers.Alice);
  expect(workspace.status).toBe(200);
  expect(workspace.body.items).toHaveLength(4);
  expect(workspace.body.ancestorScopes).toEqual([]);
  const space = await api()
    .get(`/v1/scopes/space/${id(201)}/statuses`)
    .set(headers.Alice);
  expect(space.status).toBe(200);
  expect(space.body.items).toEqual([]);
  expect(space.body.ancestorScopes).toEqual([{ ownerType: 'workspace', ownerId: id(1) }]);
  expect(
    (
      await api()
        .get(`/v1/scopes/workspace/${id(1)}/statuses`)
        .set(headers.Bob)
    ).status,
  ).toBe(403);
});

const scopeUrl = (type, owner) => `/v1/scopes/${type}/${id(owner)}/statuses`;
const config = async (type = 'workspace', owner = 1) =>
  (await api().get(scopeUrl(type, owner)).set(headers.Alice)).body;
const define = (key, expectedConfigVersion, category = 'active') => ({
  kind: 'define',
  key,
  category,
  name: key,
  color: '#123456',
  position: 10,
  expectedConfigVersion,
});

test('define reuses a canonical identity across siblings, while updates preserve identity and no-op revision', async () => {
  const initial = await config();
  const first = await api()
    .post(scopeUrl('list', 221))
    .set(headers.Alice)
    .send(define('review', initial.configVersion));
  expect(first.status).toBe(201);
  expect(first.body.configVersion).toBe(initial.configVersion + 1);
  const second = await api()
    .post(scopeUrl('list', 222))
    .set(headers.Alice)
    .send(define('review', first.body.configVersion));
  expect(second.status).toBe(201);
  expect(second.body.data.identity.id).toBe(first.body.data.identity.id);
  expect(second.body.data.override.id).not.toBe(first.body.data.override.id);
  const statusId = first.body.data.identity.id;
  const patched = await api()
    .patch(`${scopeUrl('list', 221)}/${statusId}`)
    .set(headers.Alice)
    .send({
      name: 'Ready for review',
      position: 0,
      expectedConfigVersion: second.body.configVersion,
    });
  expect(patched.status).toBe(200);
  expect(patched.body.data.identity).toEqual(first.body.data.identity);
  expect(patched.body.data.override).toMatchObject({ name: 'Ready for review', position: 0 });
  const noop = await api()
    .patch(`${scopeUrl('list', 221)}/${statusId}`)
    .set(headers.Alice)
    .send({ name: 'Ready for review', expectedConfigVersion: patched.body.configVersion });
  expect(noop.status).toBe(200);
  expect(noop.body).toEqual(patched.body);
});

test('required categories and in-use optional statuses reject atomically', async () => {
  const before = await config();
  const hiddenDone = await api()
    .patch(`${scopeUrl('workspace', 1)}/${id(402)}`)
    .set(headers.Alice)
    .send({ hidden: true, expectedConfigVersion: before.configVersion });
  expect(hiddenDone.status).toBe(409);
  expect(hiddenDone.body.error.code).toBe('CONFIG_INVALIDATES_TASKS');
  const closed = await api()
    .patch(`${scopeUrl('workspace', 1)}/${id(403)}`)
    .set(headers.Alice)
    .send({ hidden: true, expectedConfigVersion: before.configVersion });
  expect(closed.status).toBe(409);
  expect(closed.body.error.code).toBe('STATUS_IN_USE');
  const removed = await api()
    .delete(`${scopeUrl('workspace', 1)}/${id(403)}`)
    .set(headers.Alice)
    .send({ expectedConfigVersion: before.configVersion });
  expect(removed.status).toBe(409);
  // Discovery has a partial closed override which becomes incomplete without its ancestor.
  expect(removed.body.error.code).toBe('CONFIG_INVALIDATES_TASKS');
  const localInUse = await api()
    .delete(`${scopeUrl('list', 222)}/${id(405)}`)
    .set(headers.Alice)
    .send({ expectedConfigVersion: before.configVersion });
  expect(localInUse.status).toBe(409);
  expect(localInUse.body.error.code).toBe('STATUS_IN_USE');
  expect(await config()).toEqual(before);
});

test('hidden inherited identities can be restored and removing a child override reveals fallback', async () => {
  const before = await config();
  // Discovery hides closed locally; another explicit child row can restore a hidden ancestor.
  const added = await api()
    .post(scopeUrl('space', 202))
    .set(headers.Alice)
    .send({
      kind: 'override',
      statusId: id(403),
      hidden: true,
      expectedConfigVersion: before.configVersion,
    });
  expect(added.status).toBe(201);
  const restored = await api()
    .patch(`${scopeUrl('list', 223)}/${id(403)}`)
    .set(headers.Alice)
    .send({ hidden: false, expectedConfigVersion: added.body.configVersion });
  expect(restored.status).toBe(200);
  expect(
    (
      await api()
        .get(`/v1/lists/${id(223)}/resolved-statuses`)
        .set(headers.Alice)
    ).body.items.some((status) => status.id === id(403)),
  ).toBe(true);
  const childDeleted = await api()
    .delete(`${scopeUrl('list', 223)}/${id(403)}`)
    .set(headers.Alice)
    .send({ expectedConfigVersion: restored.body.configVersion });
  expect(childDeleted.status).toBe(204);
  expect(childDeleted.text).toBe('');
  const latest = await config();
  expect(
    (
      await api()
        .get(`/v1/lists/${id(223)}/resolved-statuses`)
        .set(headers.Alice)
    ).body.items.some((status) => status.id === id(403)),
  ).toBe(false);
  const newChild = await api()
    .post(scopeUrl('list', 223))
    .set(headers.Alice)
    .send({
      kind: 'override',
      statusId: id(403),
      hidden: false,
      expectedConfigVersion: latest.configVersion,
    });
  expect(newChild.status).toBe(201);
});

test('strict inputs, local row IDs, owners, roles and stale writes fail closed', async () => {
  const before = await config();
  for (const patch of [
    { category: 'closed' },
    { key: 'fake' },
    { workspaceId: id(2) },
    { ownerId: id(222) },
    {},
  ]) {
    const response = await api()
      .patch(`${scopeUrl('workspace', 1)}/${id(400)}`)
      .set(headers.Alice)
      .send({ ...patch, expectedConfigVersion: before.configVersion });
    expect(response.status).toBe(400);
  }
  expect(
    (
      await api()
        .patch(`${scopeUrl('list', 221)}/${id(400)}`)
        .set(headers.Alice)
        .send({ name: 'Missing', expectedConfigVersion: before.configVersion })
    ).status,
  ).toBe(404);
  expect(
    (
      await api()
        .patch(`${scopeUrl('workspace', 1)}/${id(500)}`)
        .set(headers.Alice)
        .send({ name: 'Wrong ID', expectedConfigVersion: before.configVersion })
    ).status,
  ).toBe(404);
  expect(
    (
      await api()
        .post(scopeUrl('list', 221))
        .set(headers.Bob)
        .send(define('forbidden', before.configVersion))
    ).status,
  ).toBe(403);
  expect(
    (
      await api()
        .post(scopeUrl('workspace', 1))
        .set(headers.Dan)
        .send(define('foreign', before.configVersion))
    ).status,
  ).toBe(404);
  expect((await api().get(scopeUrl('folder', 221)).set(headers.Alice)).status).toBe(404);
  expect(
    (
      await api()
        .get(`/v1/lists/${id(211)}/resolved-statuses`)
        .set(headers.Alice)
    ).status,
  ).toBe(404);
  expect(
    (
      await api()
        .get(scopeUrl('workspace', 1) + '?cursor=ignored')
        .set(headers.Alice)
    ).status,
  ).toBe(400);
  expect((await api().get(scopeUrl('workspace', 1))).status).toBe(401);
  expect(
    (
      await api()
        .post(scopeUrl('list', 221))
        .set(headers.Alice)
        .send(define('todo', before.configVersion, 'active'))
    ).status,
  ).toBe(409);
  expect(
    (
      await api()
        .post(scopeUrl('list', 221))
        .set(headers.Alice)
        .send({
          kind: 'override',
          statusId: id(405),
          name: 'Sibling only',
          expectedConfigVersion: before.configVersion,
        })
    ).status,
  ).toBe(404);
  expect(
    (
      await api()
        .patch(`${scopeUrl('workspace', 1)}/${id(400)}`)
        .set(headers.Alice)
        .send({ name: 'Stale', expectedConfigVersion: before.configVersion - 1 })
    ).status,
  ).toBe(409);
  expect(await config()).toEqual(before);
});

test('concurrent configuration changes serialize and return one stale conflict', async () => {
  const before = await config();
  const responses = await Promise.all(
    ['racing_a', 'racing_b'].map((key) =>
      api().post(scopeUrl('list', 221)).set(headers.Alice).send(define(key, before.configVersion)),
    ),
  );
  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  expect((await config()).configVersion).toBe(before.configVersion + 1);
});
