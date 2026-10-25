import { setTimeout } from 'node:timers/promises';

import { createDatabase, DemoAccounts, DemoPassword, seedDemoData } from '@flowboard/database';
import { createLogger } from '@flowboard/logger';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin } from '../../../test/common/auth-fixtures.mjs';

const id = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let fixture;
let onFieldWrite;
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
        if (event.event === 'operation.started' && event.operation === 'fields.write')
          onFieldWrite?.();
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
const scopeUrl = (type = 'workspace', owner = 1) => `/v1/scopes/${type}/${id(owner)}/fields`;
const config = async (type = 'workspace', owner = 1) => {
  const response = await api().get(scopeUrl(type, owner)).set(headers.Alice);
  expect(response.status).toBe(200);

  return response.body;
};

test('resolved schemas inherit workspace defaults and replace complete sibling definitions', async () => {
  const general = await api()
    .get(`/v1/lists/${id(221)}/resolved-fields`)
    .set(headers.Bob);
  expect(general.status).toBe(200);
  const fields = general.body.items;
  expect(fields.map((field) => field.key)).toEqual(['effort', 'release_date', 'team']);
  expect(fields.find((field) => field.key === 'effort')).toMatchObject({
    id: id(601),
    required: true,
    type: 'number',
    isInherited: true,
    source: { fieldId: id(601), ownerType: 'workspace', ownerId: id(1) },
  });
  expect(fields.find((field) => field.key === 'team').options.map((option) => option.id)).toEqual([
    id(610),
    id(611),
  ]);
  const privateList = await api()
    .get(`/v1/lists/${id(222)}/resolved-fields`)
    .set(headers.Alice);
  expect(privateList.status).toBe(200);
  expect(privateList.body.items.find((field) => field.key === 'team')).toMatchObject({
    id: id(604),
    isInherited: false,
    source: { fieldId: id(604), ownerType: 'list' },
  });
  expect(
    privateList.body.items.find((field) => field.key === 'team').options.map((option) => option.id),
  ).toEqual([id(612), id(613)]);
  const otherSpace = await api()
    .get(`/v1/lists/${id(223)}/resolved-fields`)
    .set(headers.Alice);
  expect(otherSpace.status).toBe(200);
  expect(otherSpace.body.items.map((field) => field.id)).toEqual([id(609), id(601)]);
  expect(otherSpace.body.items[0]).toMatchObject({
    type: 'text',
    isInherited: true,
    source: { ownerType: 'space', ownerId: id(202) },
  });
  expect(
    new Set([
      general.body.configVersion,
      privateList.body.configVersion,
      otherSpace.body.configVersion,
    ]).size,
  ).toBe(1);
  const local = await config('list', 222);
  expect(local.items.map((field) => field.id)).toEqual([id(604)]);
  expect(local.ancestorScopes).toEqual([
    { ownerType: 'workspace', ownerId: id(1) },
    { ownerType: 'space', ownerId: id(201) },
    { ownerType: 'folder', ownerId: id(211) },
  ]);
});

const definition = (key, expectedConfigVersion, extra = {}) => ({
  key,
  name: key,
  type: 'text',
  required: false,
  options: [],
  position: 10,
  expectedConfigVersion,
  ...extra,
});
const option = { id: id(950), label: 'Selected', color: '#ABCDEF' };

test('all six types support create, update, stable no-op and safe unused removal', async () => {
  for (const [type, ownerType, owner] of [
    ['text', 'workspace', 1],
    ['number', 'space', 202],
    ['single_select', 'folder', 212],
    ['multi_select', 'list', 223],
    ['date', 'space', 202],
    ['checkbox', 'list', 221],
  ]) {
    const initial = await config(ownerType, owner);
    const created = await api()
      .post(scopeUrl(ownerType, owner))
      .set(headers.Alice)
      .send(
        definition(`sample_${type}`, initial.configVersion, {
          type,
          options: type.includes('select') ? [option] : [],
        }),
      );
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      workspaceId: id(1),
      ownerId: id(owner),
      ownerType,
      type,
    });
    expect(created.body.data.createdAt).toMatch(/Z$/);
    expect(created.body.configVersion).toBe(initial.configVersion + 1);
    const url = `${scopeUrl(ownerType, owner)}/${created.body.data.id}`;
    const updated = await api()
      .patch(url)
      .set(headers.Alice)
      .send({ name: `Updated ${type}`, expectedConfigVersion: created.body.configVersion });
    expect(updated.status).toBe(200);
    expect(updated.body.data.createdAt).toBe(created.body.data.createdAt);
    const noop = await api()
      .patch(url)
      .set(headers.Alice)
      .send({
        name: `Updated ${type}`,
        options: created.body.data.options.map(({ id: optionId, label, color }) => ({
          color,
          label,
          id: optionId,
        })),
        expectedConfigVersion: updated.body.configVersion,
      });
    expect(noop.status).toBe(200);
    expect(noop.body).toEqual(updated.body);
    const removed = await api()
      .delete(url)
      .set(headers.Alice)
      .send({ expectedConfigVersion: noop.body.configVersion });
    expect(removed.status).toBe(204);
    expect(removed.text).toBe('');
    expect(
      (await config(ownerType, owner)).items.some((field) => field.id === created.body.data.id),
    ).toBe(false);
  }
});

test('configuration is admin-only and every owner is tenant, type and ancestor checked', async () => {
  for (const [path, actor, status] of [
    [scopeUrl(), 'Bob', 403],
    [scopeUrl('workspace', 2), 'Alice', 404],
    [scopeUrl('space', 211), 'Alice', 404],
    [scopeUrl('task', 221), 'Alice', 400],
    [`/v1/lists/${id(222)}/resolved-fields`, 'Bob', 403],
    [`/v1/lists/${id(223)}/resolved-fields`, 'Bob', 403],
    [`/v1/lists/${id(221)}/resolved-fields`, 'Dan', 404],
  ])
    expect((await api().get(path).set(headers[actor])).status).toBe(status);
  expect((await api().get(scopeUrl())).status).toBe(401);
  const version = (await config()).configVersion;
  expect(
    (await api().post(scopeUrl()).set(headers.Bob).send(definition('forbidden', version))).status,
  ).toBe(403);
  expect(
    (
      await api()
        .patch(`${scopeUrl()}/${id(601)}`)
        .set(headers.Bob)
        .send({ name: 'No', expectedConfigVersion: version })
    ).status,
  ).toBe(403);
  expect(
    (
      await api()
        .delete(`${scopeUrl()}/${id(601)}`)
        .set(headers.Bob)
        .send({ expectedConfigVersion: version })
    ).status,
  ).toBe(403);
  for (const path of [scopeUrl('space', 201), `/v1/lists/${id(221)}/resolved-fields`])
    expect((await api().get(`${path}?limit=10`).set(headers.Alice)).status).toBe(400);
});

test('malformed mutations and duplicate local keys reject without changing configuration', async () => {
  const initial = await config('space', 201);
  const version = initial.configVersion;
  for (const extra of [
    { options: [option] },
    { name: null },
    { key: 'invalid-key' },
    { type: 'unknown' },
    { workspaceId: id(2) },
    { createdAt: '2026-01-01T00:00:00.000Z' },
    { type: 'single_select', options: [option, { ...option, id: option.id.toUpperCase() }] },
  ])
    expect(
      (
        await api()
          .post(scopeUrl('space', 201))
          .set(headers.Alice)
          .send(definition('invalid', version, extra))
      ).status,
    ).toBe(400);
  expect(
    (await api().post(scopeUrl('space', 201)).set(headers.Alice).send(definition('team', version)))
      .status,
  ).toBe(409);
  for (const patch of [
    {},
    { name: null },
    { key: 'renamed' },
    { ownerId: id(202) },
    { type: 'text' },
  ]) {
    const response = await api()
      .patch(`${scopeUrl('space', 201)}/${id(602)}`)
      .set(headers.Alice)
      .send({ ...patch, expectedConfigVersion: version });
    expect(response.status).toBe(400);
    expect(response.body.error.details).toBeDefined();
  }
  for (const [type, owner, field] of [
    ['workspace', 1, 602],
    ['space', 201, 604],
    ['workspace', 1, 605],
  ])
    expect(
      (
        await api()
          .patch(`${scopeUrl(type, owner)}/${id(field)}`)
          .set(headers.Alice)
          .send({ name: 'No', expectedConfigVersion: version })
      ).status,
    ).toBe(404);
  expect(await config('space', 201)).toEqual(initial);
});

test('in-use deletion and changes that invalidate live task fields roll back', async () => {
  const initial = await config();
  const removed = await api()
    .delete(`${scopeUrl()}/${id(601)}`)
    .set(headers.Alice)
    .send({ expectedConfigVersion: initial.configVersion });
  expect(removed.status).toBe(409);
  expect(removed.body.error.code).toBe('FIELD_IN_USE');
  expect(removed.body.error.details[0].path).toEqual(['customFields', 'effort']);
  const typeChange = await api()
    .patch(`${scopeUrl()}/${id(601)}`)
    .set(headers.Alice)
    .send({ type: 'text', expectedConfigVersion: initial.configVersion });
  expect(typeChange.status).toBe(409);
  expect(typeChange.body.error.code).toBe('CONFIG_INVALIDATES_TASKS');
  expect(await config()).toEqual(initial);
  const space = await config('space', 201);
  const optionChange = await api()
    .patch(`${scopeUrl('space', 201)}/${id(602)}`)
    .set(headers.Alice)
    .send({ options: [space.items[0].options[0]], expectedConfigVersion: space.configVersion });
  expect(optionChange.status).toBe(409);
  expect(optionChange.body.error.details[0].path).toEqual(['customFields', 'team']);
  const required = await api()
    .post(scopeUrl('workspace', 1))
    .set(headers.Alice)
    .send(definition('new_required', initial.configVersion, { required: true }));
  expect(required.status).toBe(409);
  expect(required.body.error.details[0].path).toEqual(['customFields', 'new_required']);
  expect(await config()).toEqual(initial);
});

test('compatible fallback and whole-definition shadows allow safe changes', async () => {
  const initial = await config();
  const local = await api()
    .post(scopeUrl('list', 221))
    .set(headers.Alice)
    .send(definition('effort', initial.configVersion, { required: false, type: 'number' }));
  expect(local.status).toBe(201);
  const removed = await api()
    .delete(`${scopeUrl('list', 221)}/${local.body.data.id}`)
    .set(headers.Alice)
    .send({ expectedConfigVersion: local.body.configVersion });
  expect(removed.status).toBe(204);
  const after = await config();
  const noopStale = await api()
    .patch(`${scopeUrl()}/${id(601)}`)
    .set(headers.Alice)
    .send({ name: after.items[0].name, expectedConfigVersion: initial.configVersion });
  expect(noopStale.status).toBe(409);
  const badOverride = await api()
    .post(scopeUrl('list', 221))
    .set(headers.Alice)
    .send(definition('effort', after.configVersion, { type: 'checkbox' }));
  expect(badOverride.status).toBe(409);
  expect((await config()).configVersion).toBe(after.configVersion);
});

test('field writes recheck a demoted administrator inside the locked transaction', async () => {
  const before = await config();
  const promoted = await api()
    .patch(`/v1/workspaces/${id(1)}/members/${id(103)}`)
    .set(headers.Alice)
    .send({ role: 'admin', expectedConfigVersion: before.configVersion });
  expect(promoted.status).toBe(200);
  const revision = promoted.body.configVersion;
  const database = createDatabase(fixture.infrastructure.databaseUrl);
  const context = { actorUserId: id(101), workspaceId: id(1) };
  let release;
  let signal;
  const locked = new Promise((resolve) => {
    signal = resolve;
  });
  const finish = new Promise((resolve) => {
    release = resolve;
  });
  const transaction = database.write(context, async (store) => {
    await store.memberships.update(id(101), { role: 'member', expectedConfigVersion: revision });
    signal();
    await finish;
  });
  let pending;
  const lockTimeout = new AbortController();
  try {
    await Promise.race([
      locked,
      transaction.then(() => {
        throw new Error('Lock transaction completed before signaling');
      }),
      setTimeout(5000, undefined, { signal: lockTimeout.signal }).then(() => {
        throw new Error('Lock transaction did not become ready');
      }),
    ]);
    lockTimeout.abort();
    const began = new Promise((resolve) => {
      onFieldWrite = resolve;
    });
    pending = api()
      .post(scopeUrl('list', 221))
      .set(headers.Alice)
      .send(definition('after_demotion', revision))
      .timeout({ deadline: 8000, response: 5000 })
      .then((response) => response);
    const timeout = new AbortController();
    try {
      await Promise.race([
        began,
        setTimeout(2000, undefined, { signal: timeout.signal }).then(() => {
          throw new Error('Field writer did not reach the transaction boundary');
        }),
      ]);
    } finally {
      timeout.abort();
    }
    release();
    await transaction;
    const response = await pending;
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
    const local = await database.read({ actorUserId: id(103), workspaceId: id(1) }, (store) =>
      store.fields.local({ ownerType: 'list', ownerId: id(221) }),
    );
    expect(local.items.some((item) => item.key === 'after_demotion')).toBe(false);
    expect(local.configVersion).toBe(revision + 1);
  } finally {
    onFieldWrite = undefined;
    lockTimeout.abort();
    release();
    await Promise.allSettled([transaction, pending].filter(Boolean));
    await database.close();
  }
});
