import {
  applyTaskFieldPatch,
  BulkTaskMutationEnvelopeSchema,
  BulkUpdateTasksSchema,
  FieldKeySchema,
  FieldValueSchema,
  PrioritySchema,
  TaskSchema,
  validateTaskFields,
} from '@flowboard/contracts';
import { z } from 'zod';

import type { BulkUpdateTasks, ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';

const DraftSchema = z.strictObject({
  operation: z.enum(['status', 'priority', 'assignees', 'custom-field']),
  statusId: z.string(),
  priority: PrioritySchema,
  assigneeIds: TaskSchema.shape.assigneeIds,
  fieldKey: z.string(),
  customFields: z.record(FieldKeySchema, FieldValueSchema.nullable()),
});

export type BulkTaskDraft = z.infer<typeof DraftSchema>;

function patchFor(draft: BulkTaskDraft): BulkUpdateTasks['patch'] {
  if (draft.operation === 'status') return { statusId: draft.statusId };

  if (draft.operation === 'priority') return { priority: draft.priority };

  if (draft.operation === 'assignees') return { assigneeIds: draft.assigneeIds };

  return { customFields: { [draft.fieldKey]: draft.customFields[draft.fieldKey] ?? null } };
}

export function bulkTaskDefaults(
  fields: readonly ResolvedField[],
  statuses: readonly ResolvedStatus[],
): BulkTaskDraft {
  return {
    operation: 'status',
    statusId: statuses[0]?.id ?? '',
    priority: 'normal',
    assigneeIds: [],
    fieldKey: fields[0]?.key ?? '',
    customFields: Object.fromEntries(fields.map(({ key }) => [key, null])),
  };
}

export function bulkTaskDraftSchema(
  fields: readonly ResolvedField[],
  statuses: readonly ResolvedStatus[],
  tasks: readonly Task[],
) {
  return DraftSchema.superRefine((draft, context) => {
    if (draft.operation === 'status' && !statuses.some(({ id }) => id === draft.statusId))
      context.addIssue({
        code: 'custom',
        path: ['statusId'],
        message: 'Choose an available status.',
      });

    if (new Set(draft.assigneeIds).size !== draft.assigneeIds.length)
      context.addIssue({
        code: 'custom',
        path: ['assigneeIds'],
        message: 'Choose each assignee once.',
      });

    if (draft.operation !== 'custom-field') return;

    if (!fields.some(({ key }) => key === draft.fieldKey)) {
      context.addIssue({
        code: 'custom',
        path: ['fieldKey'],
        message: 'Choose an available custom field.',
      });

      return;
    }

    for (const task of tasks) {
      const result = applyTaskFieldPatch({
        fields,
        current: task.customFields,
        patch: patchFor(draft).customFields,
      });
      if (result.success) continue;

      for (const issue of result.issues)
        context.addIssue({ code: 'custom', path: issue.path, message: issue.message });

      return;
    }
  });
}

export function bulkTaskInput(draft: BulkTaskDraft, tasks: readonly Task[], configVersion: number) {
  return BulkUpdateTasksSchema.parse({
    expectedConfigVersion: configVersion,
    tasks: tasks.map(({ id, version }) => ({ id, expectedVersion: version })),
    patch: patchFor(draft),
  });
}

export function selectBulkTasks(
  current: readonly Task[],
  ids: readonly string[],
  loaded: readonly Task[],
): readonly Task[] {
  if (ids.length > 50 || new Set(ids).size !== ids.length) return current;

  const byId = new Map([...loaded, ...current].map((task) => [task.id, task]));
  if (ids.some((id) => !byId.has(id))) return current;

  return ids.map((id) => byId.get(id)!);
}

export function readBulkTaskResponse(
  value: unknown,
  expected: {
    command: BulkUpdateTasks;
    fields: readonly ResolvedField[];
    listId: string;
    statuses: readonly ResolvedStatus[];
    tasks: readonly Task[];
    workspaceId: string | null;
  },
) {
  const parsed = BulkTaskMutationEnvelopeSchema.safeParse(value);
  if (
    !parsed.success ||
    parsed.data.configVersion !== expected.command.expectedConfigVersion ||
    parsed.data.data.length !== expected.tasks.length
  )
    return { success: false as const };

  const changed = new Set(parsed.data.changedTaskIds);
  if (
    changed.size !== parsed.data.changedTaskIds.length ||
    [...changed].some((id) => !expected.tasks.some((task) => task.id === id))
  )
    return { success: false as const };

  for (const [index, task] of parsed.data.data.entries()) {
    const before = expected.tasks[index]!;
    if (
      task.id !== before.id ||
      task.workspaceId !== expected.workspaceId ||
      task.primaryListId !== expected.listId ||
      task.archivedAt !== null ||
      task.version !== before.version + (changed.has(task.id) ? 1 : 0) ||
      !expected.statuses.some(({ id }) => id === task.statusId) ||
      validateTaskFields({ fields: expected.fields, values: task.customFields }).length > 0 ||
      new Set(task.assigneeIds).size !== task.assigneeIds.length ||
      task.assigneeIds.length !== task.assignees.length ||
      task.assignees.some((member, memberIndex) => member.id !== task.assigneeIds[memberIndex])
    )
      return { success: false as const };

    const patch = expected.command.patch;
    if (
      (patch.statusId !== undefined && task.statusId !== patch.statusId) ||
      (patch.priority !== undefined && task.priority !== patch.priority) ||
      (patch.assigneeIds !== undefined &&
        JSON.stringify(task.assigneeIds) !== JSON.stringify([...patch.assigneeIds].sort())) ||
      (patch.customFields !== undefined &&
        Object.entries(patch.customFields).some(([key, fieldValue]) =>
          fieldValue === null
            ? Object.hasOwn(task.customFields, key)
            : JSON.stringify(task.customFields[key]) !== JSON.stringify(fieldValue),
        ))
    )
      return { success: false as const };
  }

  return { success: true as const, response: parsed.data };
}
