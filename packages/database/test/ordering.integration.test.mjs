import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, test } from '@jest/globals';

import { createDatabase } from '../dist/index.js';

import { fixtures, insert } from './fixtures.mjs';
import { applicationUrl, migrate, startPostgres } from './postgres.mjs';

let postgres;
let database;
let data;
beforeAll(async () => {
  postgres = await startPostgres();
  migrate(postgres.connectionString);
  data = await fixtures(postgres.client);
  database = createDatabase(await applicationUrl(postgres));
});
afterAll(async () => {
  await database?.close();
  await postgres?.client.end();
  postgres?.stop();
});

async function group(count, positions) {
  const workspace = await insert(postgres.client, 'workspaces', {
    id: randomUUID(),
    name: 'Ordering fixture',
  });
  await insert(postgres.client, 'memberships', {
    workspace_id: workspace.id,
    user_id: data.user.id,
    role: 'admin',
  });
  const nodes = [];
  for (let index = 0; index < count; index += 1)
    nodes.push(
      await insert(postgres.client, 'nodes', {
        id: randomUUID(),
        workspace_id: workspace.id,
        name: `Space ${index}`,
        type: 'space',
        position: positions?.[index] ?? index,
      }),
    );

  return { context: { workspaceId: workspace.id, actorUserId: data.user.id }, nodes };
}
async function stored(context) {
  return (
    await postgres.client.query(
      'SELECT id,position,version,created_at,updated_at FROM nodes WHERE workspace_id=$1 ORDER BY position,id',
      [context.workspaceId],
    )
  ).rows;
}

test('reordering more than one hundred siblings updates every changed row once', async () => {
  const { context, nodes } = await group(105);
  const result = await database.write(context, (store) =>
    store.hierarchy.reorder(nodes[104].id, {
      expectedVersion: 1,
      expectedConfigVersion: 1,
      placement: { edge: 'start' },
    }),
  );
  expect(result).toMatchObject({
    node: { id: nodes[104].id, position: 0, version: 2 },
    configVersion: 2,
    dataVersion: 2,
  });
  const rows = await stored(context);
  expect(rows.map((row) => row.id)).toEqual([
    nodes[104].id,
    ...nodes.slice(0, 104).map((node) => node.id),
  ]);
  expect(rows.map((row) => row.position)).toEqual(Array.from({ length: 105 }, (_, index) => index));
  expect(rows.every((row) => row.version === 2)).toBe(true);
  const events = (
    await postgres.client.query(
      'SELECT aggregate_id,aggregate_type,aggregate_version,payload FROM outbox_events WHERE workspace_id=$1',
      [context.workspaceId],
    )
  ).rows;
  expect(events.filter((event) => event.aggregate_type === 'node')).toHaveLength(105);
  expect(events.filter((event) => event.aggregate_type === 'workspace_config')).toHaveLength(1);
  expect(events.every((event) => event.aggregate_version === 2)).toBe(true);
  for (const event of events.filter((item) => item.aggregate_type === 'node'))
    expect(event.payload).toMatchObject({
      nodeId: event.aggregate_id,
      nodeVersion: event.aggregate_version,
      operation: 'updated',
      workspaceId: context.workspaceId,
    });
});

test('tied and gapped positions normalize by stable UUID order and then become a no-op', async () => {
  const { context, nodes } = await group(3, [0, 0, 20]);
  const tied = nodes.slice(0, 2).sort((left, right) => left.id.localeCompare(right.id));
  const target = nodes[2];
  await database.write(context, (store) =>
    store.hierarchy.reorder(target.id, {
      expectedVersion: 1,
      expectedConfigVersion: 1,
      placement: { edge: 'end' },
    }),
  );
  const rows = await stored(context);
  expect(rows.map((row) => [row.id, row.position, row.version])).toEqual([
    [tied[0].id, 0, 1],
    [tied[1].id, 1, 2],
    [target.id, 2, 2],
  ]);
  const unchanged = await database.write(context, (store) =>
    store.hierarchy.reorder(target.id, {
      expectedVersion: 2,
      expectedConfigVersion: 2,
      placement: { edge: 'end' },
    }),
  );
  expect(unchanged).toMatchObject({ configVersion: 2, dataVersion: 2 });
  expect(await stored(context)).toEqual(rows);
});

test('a target keeping its numeric position does not get a spurious version increment', async () => {
  const { context, nodes } = await group(2, [0, 0]);
  const target = [...nodes].sort((left, right) => left.id.localeCompare(right.id))[1];
  const result = await database.write(context, (store) =>
    store.hierarchy.reorder(target.id, {
      expectedVersion: 1,
      expectedConfigVersion: 1,
      placement: { edge: 'start' },
    }),
  );
  expect(result).toMatchObject({
    node: { id: target.id, position: 0, version: 1 },
    configVersion: 2,
    dataVersion: 2,
  });
  const rows = await stored(context);
  expect(rows[0].updated_at).toEqual(target.updated_at);
  expect(rows[1].version).toBe(2);
});

test('a final outbox failure rolls every changed position, version and event back', async () => {
  const { context, nodes } = await group(3);
  const before = await stored(context);
  await insert(postgres.client, 'outbox_events', {
    id: randomUUID(),
    workspace_id: context.workspaceId,
    actor_id: context.actorUserId,
    aggregate_id: context.workspaceId,
    aggregate_type: 'workspace_config',
    aggregate_version: 2,
    event_type: 'workspace.config.updated',
    payload: '{}',
  });
  await expect(
    database.write(context, (store) =>
      store.hierarchy.reorder(nodes[2].id, {
        expectedVersion: 1,
        expectedConfigVersion: 1,
        placement: { edge: 'start' },
      }),
    ),
  ).rejects.toThrow();
  expect(await stored(context)).toEqual(before);
  expect(
    (await database.read(context, (store) => store.access.snapshot())).workspace,
  ).toMatchObject({ configVersion: 1, dataVersion: 1 });
  expect(
    (
      await postgres.client.query(
        'SELECT count(*)::int AS count FROM outbox_events WHERE workspace_id=$1',
        [context.workspaceId],
      )
    ).rows[0].count,
  ).toBe(1);
});

test('two reorder writers cannot both apply the same observed revision', async () => {
  const { context, nodes } = await group(3);
  const results = await Promise.allSettled([
    database.write(context, (store) =>
      store.hierarchy.reorder(nodes[2].id, {
        expectedVersion: 1,
        expectedConfigVersion: 1,
        placement: { edge: 'start' },
      }),
    ),
    database.write(context, (store) =>
      store.hierarchy.reorder(nodes[0].id, {
        expectedVersion: 1,
        expectedConfigVersion: 1,
        placement: { edge: 'end' },
      }),
    ),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected').reason).toMatchObject({
    code: 'CONFIG_CONFLICT',
  });
  expect((await stored(context)).map((row) => row.position)).toEqual([0, 1, 2]);
});

test('archive racing with reorder leaves a consistent subtree and one committed command', async () => {
  const { context, nodes } = await group(2);
  const results = await Promise.allSettled([
    database.write(context, (store) =>
      store.hierarchy.archive(nodes[0].id, { expectedConfigVersion: 1, expectedVersion: 1 }),
    ),
    database.write(context, (store) =>
      store.hierarchy.reorder(nodes[0].id, {
        expectedVersion: 1,
        expectedConfigVersion: 1,
        placement: { edge: 'end' },
      }),
    ),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(['CONFIG_CONFLICT', 'NOT_FOUND']).toContain(
    results.find((result) => result.status === 'rejected').reason.code,
  );
  expect(
    (await database.read(context, (store) => store.access.snapshot())).workspace,
  ).toMatchObject({ configVersion: 2, dataVersion: 2 });
});
