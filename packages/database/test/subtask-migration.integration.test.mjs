import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';

import { expect, test } from '@jest/globals';

import { fixtures, insert } from './fixtures.mjs';
import { startPostgres } from './postgres.mjs';

test('parent migration preserves existing rows and enforces same-list links including archived children', async () => {
  const postgres = await startPostgres();
  try {
    const root = new URL('../prisma/migrations/', import.meta.url);
    const directories = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const name of directories.filter((name) => name < '202610250003_task_parent'))
      await postgres.client.query(await readFile(new URL(`${name}/migration.sql`, root), 'utf8'));
    const data = await fixtures(postgres.client);
    const before = {};
    for (const table of ['workspaces', 'tasks', 'task_assignees', 'outbox_events', 'activities'])
      before[table] = (
        await postgres.client.query(
          `SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`,
        )
      ).rows;
    await postgres.client.query(
      await readFile(new URL('202610250003_task_parent/migration.sql', root), 'utf8'),
    );
    for (const table of Object.keys(before)) {
      const projection = table === 'tasks' ? "to_jsonb(t)-'parent_task_id'" : 'to_jsonb(t)';
      expect(
        (
          await postgres.client.query(
            `SELECT ${projection} AS row FROM ${table} t ORDER BY (${projection})::text`,
          )
        ).rows,
      ).toEqual(before[table]);
    }
    expect(
      (await postgres.client.query('SELECT parent_task_id FROM tasks')).rows.every(
        (row) => row.parent_task_id === null,
      ),
    ).toBe(true);
    const otherList = await insert(postgres.client, 'nodes', {
      id: randomUUID(),
      workspace_id: data.a.workspace.id,
      parent_id: data.a.folder.id,
      type: 'list',
      name: 'Other list',
    });
    const values = {
      id: randomUUID(),
      workspace_id: data.a.workspace.id,
      primary_list_id: data.a.list.id,
      status_id: data.a.status.id,
      title: 'Child',
      parent_task_id: data.a.task.id,
    };
    const child = await insert(postgres.client, 'tasks', values);
    await expect(
      postgres.client.query('UPDATE tasks SET parent_task_id=id WHERE id=$1', [child.id]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      postgres.client.query('UPDATE tasks SET parent_task_id=$2 WHERE id=$1', [
        child.id,
        data.b.task.id,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
    await expect(
      postgres.client.query('UPDATE tasks SET primary_list_id=$2 WHERE id=$1', [
        child.id,
        otherList.id,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
    await postgres.client.query('UPDATE tasks SET archived_at=clock_timestamp() WHERE id=$1', [
      child.id,
    ]);
    await expect(
      postgres.client.query('UPDATE tasks SET primary_list_id=$2 WHERE id=$1', [
        data.a.task.id,
        otherList.id,
      ]),
    ).rejects.toMatchObject({ code: '23503' });
  } finally {
    await postgres.client.end();
    postgres.stop();
  }
});
