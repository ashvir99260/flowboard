import { MemberPageSchema, TaskEnvelopeSchema, validateTaskFields } from '@flowboard/contracts';

import { readBoardStatuses } from '../board/board-data.ts';
import { readListFields } from '../list/list-data.ts';

import type { Member, Task } from '@flowboard/contracts';

export function assembleTaskDetail(input: {
  fields: unknown;
  listId: string;
  memberPages: readonly { cursor?: string; response: unknown }[];
  statuses: unknown;
  task: unknown;
  taskId?: string;
  workspaceId: string;
}) {
  const statuses = readBoardStatuses(input.statuses, input.workspaceId);
  if (statuses.state !== 'ready') return statuses;

  const fields = readListFields(input.fields, input.workspaceId, input.listId);
  if (fields.state !== 'ready') return fields;

  if (statuses.configVersion !== fields.configVersion) return { state: 'stale' as const };

  const members: Member[] = [];
  const cursors = new Set<string>();
  const memberIds = new Set<string>();
  let cursor: string | null | undefined;
  for (const entry of input.memberPages) {
    if (entry.cursor !== cursor) return { state: 'invalid' as const };

    const page = MemberPageSchema.safeParse(entry.response);
    if (!page.success) return { state: 'invalid' as const };

    if (page.data.configVersion !== fields.configVersion) return { state: 'stale' as const };

    for (const member of page.data.items) {
      if (memberIds.has(member.userId)) return { state: 'invalid' as const };

      memberIds.add(member.userId);
      members.push(member);
    }
    cursor = page.data.pageInfo.nextCursor;
    if (cursor !== null) {
      if (cursors.has(cursor)) return { state: 'invalid' as const };

      cursors.add(cursor);
    }
  }
  if (cursor !== null) return { state: 'pending' as const };

  let task: Task | undefined;
  if (input.taskId) {
    if (input.task === undefined) return { state: 'pending' as const };

    const parsed = TaskEnvelopeSchema.safeParse(input.task);
    if (!parsed.success) return { state: 'invalid' as const };

    task = parsed.data.data;
    if (
      task.id !== input.taskId ||
      task.workspaceId !== input.workspaceId ||
      task.primaryListId !== input.listId ||
      task.archivedAt !== null ||
      !statuses.items.some((status) => status.id === task!.statusId) ||
      validateTaskFields({ fields: fields.items, values: task.customFields }).length > 0
    )
      return { state: 'invalid' as const };

    if (parsed.data.configVersion !== fields.configVersion) return { state: 'stale' as const };
  }

  return {
    state: 'ready' as const,
    task,
    fields: fields.items,
    statuses: statuses.items,
    members,
    configVersion: fields.configVersion,
  };
}
