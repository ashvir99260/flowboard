import { TaskPageSchema } from '@flowboard/contracts';

import type { Task } from '@flowboard/contracts';

export function readTaskRelations(input: {
  listId: string;
  pages: readonly { cursor?: string; response: unknown }[];
  parentTaskId?: string;
  workspaceId: string;
}) {
  if (!input.pages.length) return { state: 'pending' as const };

  const items: Task[] = [];
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let expected: string | null | undefined;
  let revision: string | undefined;
  for (const entry of input.pages) {
    if (entry.cursor !== expected || expected === null) return { state: 'invalid' as const };

    const parsed = TaskPageSchema.safeParse(entry.response);
    if (!parsed.success) return { state: 'invalid' as const };

    const page = parsed.data;
    const current = `${page.configVersion}:${page.dataVersion}`;
    if (revision !== undefined && current !== revision) return { state: 'stale' as const };

    revision = current;
    for (const task of page.items) {
      if (
        task.workspaceId !== input.workspaceId ||
        task.primaryListId !== input.listId ||
        task.archivedAt !== null ||
        task.parentTaskId === task.id ||
        ids.has(task.id) ||
        (input.parentTaskId !== undefined && task.parentTaskId !== input.parentTaskId)
      )
        return { state: 'invalid' as const };

      ids.add(task.id);
      items.push(task);
    }
    expected = page.pageInfo.nextCursor;
    if (expected !== null) {
      if (cursors.has(expected)) return { state: 'invalid' as const };

      cursors.add(expected);
    }
  }

  return { state: 'ready' as const, items, nextCursor: expected ?? null };
}
