import { readdir, readFile } from 'node:fs/promises';

import { expect, test } from '@jest/globals';

import { fixtures } from './fixtures.mjs';
import { startPostgres } from './postgres.mjs';

test('search migration indexes existing live text without changing persisted rows', async () => {
  const postgres = await startPostgres();
  try {
    const root = new URL('../prisma/migrations/', import.meta.url);
    const directories = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const name of directories.filter((name) => name < '202610250004_task_search'))
      await postgres.client.query(await readFile(new URL(`${name}/migration.sql`, root), 'utf8'));
    const fixture = await fixtures(postgres.client);
    await postgres.client.query('UPDATE tasks SET title=$2,description=$3 WHERE id=$1', [
      fixture.a.task.id,
      'ExistingNebula',
      'SearchableDescription',
    ]);
    const snapshots = {};
    for (const table of ['workspaces', 'tasks', 'task_assignees', 'outbox_events', 'activities'])
      snapshots[table] = (
        await postgres.client.query(
          `SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`,
        )
      ).rows;
    await postgres.client.query(
      await readFile(new URL('202610250004_task_search/migration.sql', root), 'utf8'),
    );
    for (const table of Object.keys(snapshots))
      expect(
        (
          await postgres.client.query(
            `SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY to_jsonb(t)::text`,
          )
        ).rows,
      ).toEqual(snapshots[table]);
    const index = (
      await postgres.client.query(
        "SELECT i.indisvalid AS valid, pg_get_expr(i.indpred,i.indrelid) AS predicate, pg_get_indexdef(i.indexrelid) AS definition FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname='tasks_live_search_idx'",
      )
    ).rows[0];
    expect(index.valid).toBe(true);
    expect(index.predicate).toBe('(archived_at IS NULL)');
    expect(index.definition).toMatch(/USING gin/i);
    expect(index.definition).toContain('to_tsvector');
    const matches = async (query) =>
      (
        await postgres.client.query(
          "SELECT id FROM tasks WHERE workspace_id=$1 AND primary_list_id=$2 AND archived_at IS NULL AND to_tsvector('simple',coalesce(title,'') || ' ' || coalesce(description,'')) @@ websearch_to_tsquery('simple',$3)",
          [fixture.a.workspace.id, fixture.a.list.id, query],
        )
      ).rows.map((row) => row.id);
    expect(await matches('existingnebula')).toEqual([fixture.a.task.id]);
    expect(await matches('searchabledescription')).toEqual([fixture.a.task.id]);
    expect(await matches('existingneb')).toEqual([]);
    await postgres.client.query('BEGIN');
    await postgres.client.query('UPDATE tasks SET title=$2,description=$3 WHERE id=$1', [
      fixture.a.task.id,
      'RolledBackQuasar',
      '',
    ]);
    expect(await matches('existingnebula')).toEqual([]);
    expect(await matches('rolledbackquasar')).toEqual([fixture.a.task.id]);
    await postgres.client.query('ROLLBACK');
    expect(await matches('existingnebula')).toEqual([fixture.a.task.id]);
    expect(await matches('rolledbackquasar')).toEqual([]);
    await postgres.client.query('UPDATE tasks SET archived_at=clock_timestamp() WHERE id=$1', [
      fixture.a.task.id,
    ]);
    expect(await matches('existingnebula')).toEqual([]);
  } finally {
    await postgres.client.end();
    postgres.stop();
  }
});
