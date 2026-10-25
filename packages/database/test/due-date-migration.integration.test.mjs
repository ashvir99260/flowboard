import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { expect, test } from '@jest/globals';

import { createEventConsumerRepository } from '../dist/index.js';

import { fixtures, insert } from './fixtures.mjs';
import { applicationUrl, startPostgres } from './postgres.mjs';

test('calendar dates and pending status events survive a non-UTC datetime migration', async () => {
  const postgres = await startPostgres();
  let consumer;
  try {
    for (const migration of [
      '202610230001_initial',
      '202610230002_refresh_session_database_time',
      '202610240001_outbox_dispatch_handoff',
    ])
      await postgres.client.query(
        await readFile(
          new URL(`../prisma/migrations/${migration}/migration.sql`, import.meta.url),
          'utf8',
        ),
      );
    const data = await fixtures(postgres.client);
    const { a, user } = data;
    await postgres.client.query("SET TIME ZONE 'America/Los_Angeles'");
    const before = (
      await postgres.client.query(
        "UPDATE tasks SET due_date='2024-02-29', custom_fields=$2 WHERE id=$1 RETURNING *",
        [a.task.id, JSON.stringify({ release_date: '2024-02-29' })],
      )
    ).rows[0];
    const afterStatus = await insert(postgres.client, 'status_identities', {
      id: randomUUID(),
      workspace_id: a.workspace.id,
      key: 'active',
      category: 'active',
    });
    const eventId = randomUUID();
    const payload = {
      eventId,
      workspaceId: a.workspace.id,
      actorId: user.id,
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      taskId: a.task.id,
      taskVersion: 2,
      currentListId: a.list.id,
      previousListId: a.list.id,
      changes: {
        dueDate: { after: '2024-02-29', before: null },
        statusId: { before: a.status.id, after: afterStatus.id },
        customFieldKeys: ['release_date'],
      },
    };
    await insert(postgres.client, 'outbox_events', {
      id: eventId,
      workspace_id: a.workspace.id,
      actor_id: user.id,
      aggregate_type: 'task',
      aggregate_id: a.task.id,
      aggregate_version: 2,
      event_type: 'task.updated',
      payload: JSON.stringify(payload),
    });
    const otherId = randomUUID();
    await insert(postgres.client, 'outbox_events', {
      id: otherId,
      workspace_id: a.workspace.id,
      actor_id: user.id,
      aggregate_type: 'task',
      aggregate_id: a.task.id,
      aggregate_version: 3,
      event_type: 'task.updated',
      payload: JSON.stringify({
        ...payload,
        eventId: otherId,
        taskVersion: 3,
        changes: { dueDate: { after: null, before: '2024-02-29' } },
      }),
    });
    await postgres.client.query(
      await readFile(
        new URL(
          '../prisma/migrations/202610250001_task_due_instants/migration.sql',
          import.meta.url,
        ),
        'utf8',
      ),
    );
    const after = (await postgres.client.query('SELECT * FROM tasks WHERE id=$1', [a.task.id]))
      .rows[0];
    expect(after.due_date.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(after.custom_fields).toEqual(before.custom_fields);
    expect(after.created_at).toEqual(before.created_at);
    expect(after.updated_at).toEqual(before.updated_at);
    expect(after.version).toBe(before.version);
    expect(
      (await postgres.client.query('SELECT due_date FROM tasks WHERE id=$1', [data.b.task.id]))
        .rows[0].due_date,
    ).toBeNull();
    const events = (
      await postgres.client.query('SELECT id,payload FROM outbox_events WHERE id=ANY($1)', [
        [eventId, otherId],
      ])
    ).rows;
    expect(events.find(({ id }) => id === eventId).payload).toEqual({
      ...payload,
      changes: { ...payload.changes, dueDate: { after: '2024-02-29T00:00:00.000Z', before: null } },
    });
    expect(events.find(({ id }) => id === otherId).payload.changes.dueDate).toEqual({
      after: null,
      before: '2024-02-29T00:00:00.000Z',
    });
    consumer = createEventConsumerRepository(await applicationUrl(postgres));
    const claim = await consumer.claim(
      { eventId, workspaceId: a.workspace.id, schemaVersion: 1 },
      10000,
    );
    expect(claim).not.toBeNull();
    expect((await consumer.persist(claim)).state).toBe('ready');
    expect(
      (
        await postgres.client.query(
          'SELECT count(*)::int AS count FROM activities WHERE event_id=$1',
          [eventId],
        )
      ).rows[0].count,
    ).toBe(1);
  } finally {
    await consumer?.close();
    await postgres.client.end();
    postgres.stop();
  }
});
