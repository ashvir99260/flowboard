import { createHmac } from 'node:crypto';

import {
  ErrorEnvelopeSchema,
  FieldValuesSchema,
  ResolvedFieldCollectionSchema,
  ResolvedStatusCollectionSchema,
  TaskEnvelopeSchema,
  TaskMutationEnvelopeSchema,
  TaskPageSchema,
  validateTaskFields,
} from '@flowboard/contracts';
import { DemoAccounts, DemoPassword, seedDemoData } from '@flowboard/database';
import { afterAll, beforeAll, expect, test } from '@jest/globals';
import request from 'supertest';

import { startTestApplication } from '../../../test/common/application.mjs';
import { AuthTestOrigin, AuthTestSecret } from '../../../test/common/auth-fixtures.mjs';

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
function checked(response, schema, status = 200) {
  expect(response.status).toBe(status);

  return schema.parse(response.body);
}
const config = async () =>
  (
    await api()
      .get(`/v1/lists/${id(221)}/resolved-fields`)
      .set(headers.Alice)
  ).body.configVersion;
async function newList(name) {
  const expectedConfigVersion = await config();
  const result = await api()
    .post('/v1/nodes')
    .set(headers.Alice)
    .send({ type: 'list', name, parentId: id(211), expectedConfigVersion });
  expect(result.status).toBe(201);

  return result.body.data.id;
}
async function create(listId, extra = {}) {
  const expectedConfigVersion = await config();

  return checked(
    await api()
      .post(`/v1/lists/${listId}/tasks`)
      .set(headers.Alice)
      .send({
        title: 'Invariant task',
        statusId: id(400),
        customFields: { effort: 1 },
        expectedConfigVersion,
        ...extra,
      }),
    TaskMutationEnvelopeSchema,
    201,
  );
}
async function page(listId, cursor, limit = 2) {
  return checked(
    await api()
      .get(`/v1/lists/${listId}/tasks`)
      .query({ limit: String(limit), ...(cursor ? { cursor } : {}) })
      .set(headers.Alice),
    TaskPageSchema,
  );
}
async function allTasks(listId) {
  const tasks = [];
  let cursor;
  do {
    const result = await page(listId, cursor);
    tasks.push(...result.items);
    cursor = result.pageInfo.nextCursor;
  } while (cursor);
  expect(new Set(tasks.map((task) => task.id)).size).toBe(tasks.length);

  return tasks;
}
async function validBoard(listId) {
  const fields = checked(
    await api().get(`/v1/lists/${listId}/resolved-fields`).set(headers.Alice),
    ResolvedFieldCollectionSchema,
  );
  const statuses = checked(
    await api().get(`/v1/lists/${listId}/resolved-statuses`).set(headers.Alice),
    ResolvedStatusCollectionSchema,
  );
  const tasks = await allTasks(listId);
  for (const task of tasks) {
    expect(statuses.items.some((status) => status.id === task.statusId)).toBe(true);
    expect(
      validateTaskFields({
        fields: fields.items,
        values: FieldValuesSchema.parse(task.customFields),
      }),
    ).toEqual([]);
  }

  return tasks;
}

test('API-created tasks keep ancestor field/status changes safe and all responses typed', async () => {
  const source = await newList('Invariant source'),
    destination = await newList('Invariant destination');
  let revision = await config();
  const status = await api()
    .post(`/v1/scopes/folder/${id(211)}/statuses`)
    .set(headers.Alice)
    .send({
      kind: 'define',
      key: 'invariant_review',
      name: 'Review',
      category: 'active',
      color: '#123456',
      position: 8,
      expectedConfigVersion: revision,
    });
  expect(status.status).toBe(201);
  revision = status.body.configVersion;
  const field = await api()
    .post(`/v1/scopes/folder/${id(211)}/fields`)
    .set(headers.Alice)
    .send({
      key: 'audit_color',
      name: 'Audit color',
      type: 'single_select',
      required: false,
      position: 7,
      options: [{ id: id(9901), label: 'Blue', color: '#123456' }],
      expectedConfigVersion: revision,
    });
  expect(field.status).toBe(201);
  const created = await create(source, {
    statusId: status.body.data.identity.id,
    customFields: { effort: 0, audit_color: id(9901) },
  });
  const taskId = created.data.id;
  revision = created.configVersion;
  for (const response of [
    await api()
      .patch(`/v1/scopes/folder/${id(211)}/statuses/${status.body.data.identity.id}`)
      .set(headers.Alice)
      .send({ hidden: true, expectedConfigVersion: revision }),
    await api()
      .delete(`/v1/scopes/folder/${id(211)}/statuses/${status.body.data.identity.id}`)
      .set(headers.Alice)
      .send({ expectedConfigVersion: revision }),
    await api()
      .delete(`/v1/scopes/folder/${id(211)}/fields/${field.body.data.id}`)
      .set(headers.Alice)
      .send({ expectedConfigVersion: revision }),
    await api()
      .patch(`/v1/scopes/folder/${id(211)}/fields/${field.body.data.id}`)
      .set(headers.Alice)
      .send({ type: 'number', options: [], expectedConfigVersion: revision }),
    await api()
      .patch(`/v1/scopes/folder/${id(211)}/fields/${field.body.data.id}`)
      .set(headers.Alice)
      .send({ options: [], expectedConfigVersion: revision }),
  ]) {
    checked(response, ErrorEnvelopeSchema, 409);
    expect(
      checked(await api().get(`/v1/tasks/${taskId}`).set(headers.Alice), TaskEnvelopeSchema).data,
    ).toEqual(created.data);
    expect(await config()).toBe(revision);
  }
  await validBoard(source);
  await validBoard(destination);
  const patched = checked(
    await api()
      .patch(`/v1/tasks/${taskId}`)
      .set(headers.Alice)
      .send({
        customFields: { audit_color: null },
        expectedVersion: 1,
        expectedConfigVersion: revision,
      }),
    TaskMutationEnvelopeSchema,
  );
  const moved = checked(
    await api()
      .post(`/v1/tasks/${taskId}/move`)
      .set(headers.Alice)
      .send({
        destinationListId: destination,
        statusId: id(401),
        placement: { edge: 'start' },
        expectedVersion: patched.data.version,
        expectedConfigVersion: revision,
      }),
    TaskMutationEnvelopeSchema,
  );
  checked(
    await api()
      .post(`/v1/tasks/${taskId}/reorder`)
      .set(headers.Alice)
      .send({
        placement: { edge: 'end' },
        expectedVersion: moved.data.version,
        expectedConfigVersion: revision,
      }),
    TaskMutationEnvelopeSchema,
  );
  const removal = await api()
    .delete(`/v1/scopes/folder/${id(211)}/statuses/${status.body.data.identity.id}`)
    .set(headers.Alice)
    .send({ expectedConfigVersion: revision });
  expect(removal.status).toBe(204);
  expect(removal.text).toBe('');
  revision = await config();
  const fieldRemoval = await api()
    .delete(`/v1/scopes/folder/${id(211)}/fields/${field.body.data.id}`)
    .set(headers.Alice)
    .send({ expectedConfigVersion: revision });
  expect(fieldRemoval.status).toBe(204);
  await validBoard(source);
  await validBoard(destination);
  revision = await config();
  const archived = await api()
    .delete(`/v1/tasks/${taskId}`)
    .set(headers.Alice)
    .send({ expectedVersion: moved.data.version, expectedConfigVersion: revision });
  expect(archived.status).toBe(204);
  expect(archived.text).toBe('');
  checked(await api().get(`/v1/tasks/${taskId}`).set(headers.Alice), ErrorEnvelopeSchema, 404);
  await validBoard(source);
  await validBoard(destination);
});

const invalidQueries = [
  ['page=1', 'page'],
  ['pageNumber=1', 'pageNumber'],
  ['pageSize=1', 'pageSize'],
  ['offset=0', 'offset'],
  ['skip=1', 'skip'],
  ['take=1', 'take'],
  ['limit=1&limit=2', 'limit'],
  ['cursor=a&cursor=b', 'cursor'],
  ['sort=manual&sort=priority', 'sort'],
  ['direction=asc&direction=desc', 'direction'],
  [`statusId=${id(400)}&statusId=${id(401)}`, 'statusId'],
  ['fieldKey=effort&fieldKey=effort', 'fieldKey'],
  ['fieldOperator=eq&fieldOperator=eq', 'fieldOperator'],
  ['fieldValue=1&fieldValue=2', 'fieldValue'],
];
test.each(invalidQueries)(
  'task pages reject legacy or duplicated query %s at %s',
  async (query, key) => {
    const error = checked(
      await api()
        .get(`/v1/lists/${id(221)}/tasks?${query}`)
        .set(headers.Alice),
      ErrorEnvelopeSchema,
      400,
    );
    expect(error.error.details.some((issue) => issue.path[0] === key)).toBe(true);
  },
);

function sign(cursor, changes) {
  const value = JSON.parse(Buffer.from(cursor.split('.')[0], 'base64url').toString());
  const encoded = Buffer.from(JSON.stringify({ ...value, ...changes })).toString('base64url');

  return `${encoded}.${createHmac('sha256', AuthTestSecret).update(`flowboard:cursor:v1:${encoded}`).digest('base64url')}`;
}
test('expired and unsupported signed cursors reject while the login remains valid', async () => {
  const initial = await page(id(221), undefined, 1);
  for (const cursor of [
    sign(initial.pageInfo.nextCursor, { expiresAt: Date.now() - 1 }),
    sign(initial.pageInfo.nextCursor, { v: 2 }),
    sign(initial.pageInfo.nextCursor, { kind: 'tree' }),
  ]) {
    const error = checked(
      await api()
        .get(`/v1/lists/${id(221)}/tasks`)
        .query({ limit: '1', cursor })
        .set(headers.Alice),
      ErrorEnvelopeSchema,
      400,
    );
    expect(error.error.code).toBe('INVALID_CURSOR');
    expect(error.error.details[0].path).toEqual(['cursor']);
  }
  checked(
    await api()
      .get(`/v1/tasks/${id(700)}`)
      .set(headers.Alice),
    TaskEnvelopeSchema,
  );
});

test('pagination restart after create, move and archive returns exact live sets once', async () => {
  const source = await newList('Restart source'),
    destination = await newList('Restart destination');
  const created = [];
  for (let index = 0; index < 3; index++)
    created.push(await create(source, { title: `Restart ${index}` }));
  const first = await page(source, undefined, 1);
  const fourth = await create(source);
  created.push(fourth);
  const stale = checked(
    await api()
      .get(`/v1/lists/${source}/tasks`)
      .query({ limit: '1', cursor: first.pageInfo.nextCursor })
      .set(headers.Alice),
    ErrorEnvelopeSchema,
    409,
  );
  expect(stale.error.code).toBe('CURSOR_STALE');
  expect((await allTasks(source)).map((item) => item.id).sort()).toEqual(
    created.map((item) => item.data.id).sort(),
  );
  const next = await page(source, undefined, 1);
  const moved = checked(
    await api()
      .post(`/v1/tasks/${created[0].data.id}/move`)
      .set(headers.Alice)
      .send({
        destinationListId: destination,
        placement: { edge: 'start' },
        expectedVersion: 1,
        expectedConfigVersion: fourth.configVersion,
      }),
    TaskMutationEnvelopeSchema,
  );
  checked(
    await api()
      .get(`/v1/lists/${source}/tasks`)
      .query({ limit: '1', cursor: next.pageInfo.nextCursor })
      .set(headers.Alice),
    ErrorEnvelopeSchema,
    409,
  );
  expect((await allTasks(source)).map((item) => item.id).sort()).toEqual(
    created
      .slice(1)
      .map((item) => item.data.id)
      .sort(),
  );
  expect((await allTasks(destination)).map((item) => item.id)).toEqual([moved.data.id]);
  const beforeArchive = await page(source, undefined, 1);
  const target = checked(
    await api().get(`/v1/tasks/${created[1].data.id}`).set(headers.Alice),
    TaskEnvelopeSchema,
  );
  const archived = await api()
    .delete(`/v1/tasks/${target.data.id}`)
    .set(headers.Alice)
    .send({ expectedVersion: target.data.version, expectedConfigVersion: target.configVersion });
  expect(archived.status).toBe(204);
  checked(
    await api()
      .get(`/v1/lists/${source}/tasks`)
      .query({ limit: '1', cursor: beforeArchive.pageInfo.nextCursor })
      .set(headers.Alice),
    ErrorEnvelopeSchema,
    409,
  );
  expect((await allTasks(source)).map((item) => item.id).sort()).toEqual(
    created
      .slice(2)
      .map((item) => item.data.id)
      .sort(),
  );
  await validBoard(source);
  await validBoard(destination);
});

test.each([
  ['Bob', 708, 403],
  ['Alice', 900, 404],
])('every task entry point rejects %s accessing %s with %s', async (actor, target, status) => {
  const revision = await config();
  const routes = [
    ['get', `/v1/tasks/${id(target)}`, undefined],
    [
      'patch',
      `/v1/tasks/${id(target)}`,
      { title: 'Unauthorized', expectedVersion: 1, expectedConfigVersion: revision },
    ],
    ['delete', `/v1/tasks/${id(target)}`, { expectedVersion: 1, expectedConfigVersion: revision }],
    [
      'post',
      `/v1/tasks/${id(target)}/move`,
      {
        destinationListId: id(221),
        placement: { edge: 'start' },
        expectedVersion: 1,
        expectedConfigVersion: revision,
      },
    ],
    [
      'post',
      `/v1/tasks/${id(target)}/reorder`,
      { placement: { edge: 'start' }, expectedVersion: 1, expectedConfigVersion: revision },
    ],
  ];
  const before = checked(
    await api()
      .get(`/v1/tasks/${id(target)}`)
      .set(headers[target === 900 ? 'Dan' : 'Alice']),
    TaskEnvelopeSchema,
  );
  for (const [method, url, body] of routes)
    checked(await api()[method](url).set(headers[actor]).send(body), ErrorEnvelopeSchema, status);
  const after = checked(
    await api()
      .get(`/v1/tasks/${id(target)}`)
      .set(headers[target === 900 ? 'Dan' : 'Alice']),
    TaskEnvelopeSchema,
  );
  expect(after).toEqual(before);
});

test('all task mutation routes fail closed for missing authentication and archived tasks', async () => {
  const list = await newList('Archived source'),
    created = await create(list);
  for (const suffix of ['/move', '/reorder']) {
    const body = {
      placement: { edge: 'start' },
      expectedVersion: 1,
      expectedConfigVersion: created.configVersion,
      ...(suffix === '/move' ? { destinationListId: id(221) } : {}),
    };
    checked(
      await api().post(`/v1/tasks/${created.data.id}${suffix}`).send(body),
      ErrorEnvelopeSchema,
      401,
    );
  }
  expect(
    (
      await api()
        .delete(`/v1/tasks/${created.data.id}`)
        .set(headers.Alice)
        .send({ expectedVersion: 1, expectedConfigVersion: created.configVersion })
    ).status,
  ).toBe(204);
  for (const suffix of ['/move', '/reorder']) {
    const body = {
      placement: { edge: 'start' },
      expectedVersion: 1,
      expectedConfigVersion: created.configVersion,
      ...(suffix === '/move' ? { destinationListId: id(221) } : {}),
    };
    checked(
      await api().post(`/v1/tasks/${created.data.id}${suffix}`).set(headers.Alice).send(body),
      ErrorEnvelopeSchema,
      404,
    );
  }
  expect(await allTasks(list)).toEqual([]);
});

test('task cursor binding normalizes defaults while retaining the exact JSON filter representation', async () => {
  const list = await newList('Fingerprint test');
  await create(list);
  await create(list);
  const query = { fieldKey: 'effort', fieldOperator: 'eq', fieldValue: '1', limit: '1' };
  const initial = checked(
    await api().get(`/v1/lists/${list}/tasks`).query(query).set(headers.Alice),
    TaskPageSchema,
  );
  checked(
    await api()
      .get(`/v1/lists/${list}/tasks`)
      .query({ ...query, cursor: initial.pageInfo.nextCursor, sort: 'manual', direction: 'asc' })
      .set(headers.Alice),
    TaskPageSchema,
  );
  const mismatch = checked(
    await api()
      .get(`/v1/lists/${list}/tasks`)
      .query({ ...query, fieldValue: '1.0', cursor: initial.pageInfo.nextCursor })
      .set(headers.Alice),
    ErrorEnvelopeSchema,
    400,
  );
  expect(mismatch.error.code).toBe('INVALID_CURSOR');
});

test('reorder checks every anchor through the same permission and tenant policy', async () => {
  const created = await create(id(221));
  for (const [anchor, status] of [
    [id(708), 403],
    [id(900), 404],
  ]) {
    checked(
      await api()
        .post(`/v1/tasks/${created.data.id}/reorder`)
        .set(headers.Bob)
        .send({
          placement: { beforeId: anchor },
          expectedVersion: 1,
          expectedConfigVersion: created.configVersion,
        }),
      ErrorEnvelopeSchema,
      status,
    );
  }
  expect(
    checked(await api().get(`/v1/tasks/${created.data.id}`).set(headers.Alice), TaskEnvelopeSchema)
      .data,
  ).toEqual(created.data);
});
