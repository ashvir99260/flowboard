import { TaskMutationEnvelopeSchema, validateTaskFields } from '@flowboard/contracts';

import type { ResolvedField, ResolvedStatus } from '@flowboard/contracts';

export function readTaskWriteResponse(
  value: unknown,
  expected: {
    configVersion: number;
    fields: readonly ResolvedField[];
    listId: string;
    minVersion: number;
    statuses: readonly ResolvedStatus[];
    taskId?: string;
    workspaceId: string | null;
  },
) {
  const parsed = TaskMutationEnvelopeSchema.safeParse(value);
  if (!parsed.success) return { success: false as const };

  const task = parsed.data.data;
  if (
    parsed.data.configVersion !== expected.configVersion ||
    task.workspaceId !== expected.workspaceId ||
    task.primaryListId !== expected.listId ||
    (expected.taskId !== undefined && task.id !== expected.taskId) ||
    task.version < expected.minVersion ||
    task.archivedAt !== null ||
    !expected.statuses.some((status) => status.id === task.statusId) ||
    validateTaskFields({ fields: expected.fields, values: task.customFields }).length > 0 ||
    new Set(task.assigneeIds).size !== task.assigneeIds.length ||
    task.assigneeIds.length !== task.assignees.length ||
    task.assignees.some((member, index) => member.id !== task.assigneeIds[index])
  )
    return { success: false as const };

  return { success: true as const, response: parsed.data };
}
