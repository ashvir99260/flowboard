import {
  applyTaskFieldPatch,
  CreateTaskSchema,
  FieldKeySchema,
  FieldValueSchema,
  TaskDueDateSchema,
  TaskSchema,
  UpdateTaskSchema,
} from '@flowboard/contracts';
import { z } from 'zod';

import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';

const utcInput = (value: string) => `${value.length === 16 ? `${value}:00` : value}Z`;

const DraftSchema = TaskSchema.pick({
  assigneeIds: true,
  description: true,
  dueDate: true,
  priority: true,
  statusId: true,
  title: true,
}).extend({
  customFields: z.record(FieldKeySchema, FieldValueSchema.nullable()),
  dueDate: z
    .string()
    .refine(
      (value) => TaskDueDateSchema.safeParse(utcInput(value)).success,
      'Enter a valid UTC date and time.',
    )
    .nullable(),
});

export type TaskDraft = z.infer<typeof DraftSchema>;

export function taskDraftSchema(
  fields: readonly ResolvedField[],
  statuses: readonly ResolvedStatus[],
) {
  return DraftSchema.superRefine((draft, context) => {
    if (!statuses.some((status) => status.id === draft.statusId))
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

    const result = applyTaskFieldPatch({ fields, current: {}, patch: draft.customFields });
    if (!result.success)
      for (const issue of result.issues)
        context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  });
}

export function taskDefaults(
  fields: readonly ResolvedField[],
  statuses: readonly ResolvedStatus[],
  task?: Task,
): TaskDraft {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    statusId:
      task?.statusId ?? statuses.find((status) => status.category === 'not_started')?.id ?? '',
    priority: task?.priority ?? 'none',
    assigneeIds: [...(task?.assigneeIds ?? [])],
    dueDate: task?.dueDate ? TaskDueDateSchema.parse(task.dueDate).slice(0, -1) : null,
    customFields: Object.fromEntries(
      fields.map(({ key }) => [key, task?.customFields[key] ?? null]),
    ),
  };
}

const sameValue = (left: unknown, right: unknown) =>
  JSON.stringify(Array.isArray(left) ? left.toSorted() : left) ===
  JSON.stringify(Array.isArray(right) ? right.toSorted() : right);

function parseTaskDraft(draft: TaskDraft) {
  const parsed = DraftSchema.parse(draft);

  return {
    ...parsed,
    dueDate: parsed.dueDate === null ? null : TaskDueDateSchema.parse(utcInput(parsed.dueDate)),
  };
}

export function createTaskInput(draft: TaskDraft, configVersion: number) {
  return CreateTaskSchema.parse({
    ...parseTaskDraft(draft),
    customFields: Object.fromEntries(
      Object.entries(draft.customFields).filter(([, value]) => value !== null),
    ),
    expectedConfigVersion: configVersion,
  });
}

export function updateTaskInput(draft: TaskDraft, task: Task, configVersion: number) {
  const parsed = parseTaskDraft(draft);
  const builtins = (
    ['title', 'description', 'statusId', 'priority', 'dueDate', 'assigneeIds'] as const
  )
    .filter((key) => !sameValue(parsed[key], task[key]))
    .map((key) => [key, parsed[key]]);
  const customFields = Object.fromEntries(
    Object.entries(parsed.customFields).filter(
      ([key, value]) => !sameValue(value, task.customFields[key] ?? null),
    ),
  );
  if (builtins.length === 0 && Object.keys(customFields).length === 0) return null;

  return UpdateTaskSchema.parse({
    ...Object.fromEntries(builtins),
    ...(Object.keys(customFields).length ? { customFields } : {}),
    expectedVersion: task.version,
    expectedConfigVersion: configVersion,
  });
}
