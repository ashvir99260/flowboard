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

test('grant and revision roll back when outbox insertion fails, then commit together', async () => {
  const context = { workspaceId: data.a.workspace.id, actorUserId: data.user.id };
  const marker = await insert(postgres.client, 'outbox_events', {
    id: randomUUID(),
    workspace_id: context.workspaceId,
    actor_id: data.user.id,
    aggregate_id: context.workspaceId,
    aggregate_type: 'workspace_config',
    aggregate_version: 2,
    event_type: 'workspace.config.updated',
    payload: '{}',
  });
  const input = { userId: data.user.id, mode: 'deny', expectedConfigVersion: 1 };
  await expect(
    database.write(context, (store) => store.access.upsertGrant(data.a.list.id, input)),
  ).rejects.toThrow();
  const rolledBack = await database.read(context, (store) => store.access.snapshot());
  expect(rolledBack.workspace).toMatchObject({ configVersion: 1, dataVersion: 1 });
  expect(rolledBack.grants.find((grant) => grant.resourceId === data.a.list.id).mode).toBe('allow');
  expect(rolledBack.nodes.every((node) => node.workspaceId === context.workspaceId)).toBe(true);
  expect(
    rolledBack.grants.every(
      (grant) => grant.userId === context.actorUserId && grant.workspaceId === context.workspaceId,
    ),
  ).toBe(true);
  await postgres.client.query('DELETE FROM outbox_events WHERE id=$1', [marker.id]);
  const changed = await database.write(context, (store) =>
    store.access.upsertGrant(data.a.list.id, input),
  );
  expect(changed.configVersion).toBe(2);
  const state = await database.read(context, (store) => store.access.snapshot());
  expect(state.workspace).toMatchObject({ configVersion: 2, dataVersion: 1 });
  const event = (
    await postgres.client.query(
      "SELECT payload FROM outbox_events WHERE workspace_id=$1 AND aggregate_type='workspace_config'",
      [context.workspaceId],
    )
  ).rows[0];
  expect(event.payload).toMatchObject({
    reason: 'permission',
    configVersion: 2,
    workspaceId: context.workspaceId,
    actorId: context.actorUserId,
  });
  const unchanged = await database.write(context, (store) =>
    store.access.upsertGrant(data.a.list.id, { ...input, expectedConfigVersion: 2 }),
  );
  expect(unchanged).toEqual(changed);
  await expect(
    database.write(context, (store) =>
      store.access.removeGrant(data.b.list.id, data.user.id, { expectedConfigVersion: 2 }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    database.write(context, (store) =>
      store.access.upsertGrant(data.a.list.id, {
        ...input,
        userId: data.otherUser.id,
        expectedConfigVersion: 2,
      }),
    ),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('concurrent grant commands use one configuration winner and reject the stale writer', async () => {
  const context = { workspaceId: data.a.workspace.id, actorUserId: data.user.id };
  const results = await Promise.allSettled([
    database.write(context, (store) =>
      store.access.upsertGrant(data.a.list.id, {
        userId: data.user.id,
        mode: 'allow',
        expectedConfigVersion: 2,
      }),
    ),
    database.write(context, (store) =>
      store.access.removeGrant(data.a.list.id, data.user.id, { expectedConfigVersion: 2 }),
    ),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.find((result) => result.status === 'rejected').reason).toMatchObject({
    code: 'CONFIG_CONFLICT',
  });
  expect(
    (await database.read(context, (store) => store.access.configuration())).configVersion,
  ).toBe(3);
});
