import { ActivityPageSchema } from '@flowboard/contracts';

import type { Activity } from '@flowboard/contracts';

export function assembleActivity(input: {
  pages: readonly { cursor?: string; response: unknown }[];
  taskId: string;
  workspaceId: string;
}) {
  if (!input.pages.length) return { state: 'pending' as const };

  const items: Activity[] = [];
  const events = new Set<string>();
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let expected: string | null | undefined;
  for (const entry of input.pages) {
    if (entry.cursor !== expected) return { state: 'invalid' as const };

    const page = ActivityPageSchema.safeParse(entry.response);
    if (!page.success) return { state: 'invalid' as const };

    for (const item of page.data.items) {
      const previous = items.at(-1);
      if (
        item.workspaceId !== input.workspaceId ||
        item.taskId !== input.taskId ||
        events.has(item.eventId) ||
        ids.has(item.id) ||
        (previous &&
          (item.createdAt > previous.createdAt ||
            (item.createdAt === previous.createdAt && item.id >= previous.id)))
      )
        return { state: 'invalid' as const };

      events.add(item.eventId);
      ids.add(item.id);
      items.push(item);
    }
    expected = page.data.pageInfo.nextCursor;
    if (expected !== null) {
      if (cursors.has(expected)) return { state: 'invalid' as const };

      cursors.add(expected);
    }
  }

  return { state: 'ready' as const, items, nextCursor: expected ?? null };
}
