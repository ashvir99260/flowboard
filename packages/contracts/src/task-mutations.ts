import { z } from 'zod';

import { FieldPatchSchema, FieldValuesSchema } from './field-values.js';
import { VersionSchema } from './identifiers.js';
import { PaginationQuerySchema } from './pagination.js';
import { TaskEnvelopeSchema, TaskSchema } from './tasks.js';
import { ConfigVersionSchema } from './workspaces.js';

const assignees = TaskSchema.shape.assigneeIds.refine(
  (ids) => new Set(ids).size === ids.length,
  'Assignee IDs must be unique',
);
const writable = z.strictObject({
  title: TaskSchema.shape.title,
  description: TaskSchema.shape.description,
  statusId: TaskSchema.shape.statusId,
  priority: TaskSchema.shape.priority,
  assigneeIds: assignees,
  dueDate: TaskSchema.shape.dueDate,
  customFields: FieldValuesSchema,
});

export const CreateTaskSchema = writable
  .extend({
    description: writable.shape.description.default(''),
    priority: writable.shape.priority.default('none'),
    assigneeIds: assignees.default([]),
    dueDate: writable.shape.dueDate.default(null),
    customFields: FieldValuesSchema.default({}),
    expectedConfigVersion: ConfigVersionSchema,
  })
  .meta({
    title: 'Create task request',
    description:
      'Complete task inputs and workspace configuration precondition; defaults are validated against the list schema.',
    example: {
      title: 'Review delivery',
      statusId: TaskSchema.shape.statusId.meta()?.example,
      expectedConfigVersion: 1,
    },
  });

export const UpdateTaskSchema = writable
  .extend({ customFields: FieldPatchSchema })
  .partial()
  .extend({
    expectedVersion: VersionSchema.meta({
      description: 'Task revision loaded by the caller.',
      example: 1,
      title: 'Expected task version',
    }),
    expectedConfigVersion: ConfigVersionSchema,
  })
  .refine(
    (value) =>
      Object.entries(value).some(
        ([key, item]) =>
          item !== undefined && !['expectedVersion', 'expectedConfigVersion'].includes(key),
      ),
    'At least one task change is required',
  )
  .meta({
    title: 'Update task request',
    description:
      'Replace supplied built-ins and assignees; patch custom fields with null to clear optional values.',
    example: { expectedConfigVersion: 1, expectedVersion: 1, title: 'Reviewed delivery' },
  });

export const ArchiveTaskSchema = z
  .strictObject({
    expectedVersion: UpdateTaskSchema.shape.expectedVersion,
    expectedConfigVersion: ConfigVersionSchema,
  })
  .meta({
    title: 'Archive task request',
    description: 'Task and configuration preconditions for soft deletion.',
    example: { expectedConfigVersion: 1, expectedVersion: 1 },
  });

export const TaskMutationEnvelopeSchema = TaskEnvelopeSchema.extend({
  changedTaskIds: z.array(TaskSchema.shape.id).meta({
    title: 'Changed task IDs',
    description: 'Tasks whose revisions changed; empty for a no-op.',
    example: [],
  }),
}).meta({
  title: 'Task mutation response',
  description: 'Persisted task, revisions and changed identities.',
  example: { ...(TaskEnvelopeSchema.meta()?.example as object), changedTaskIds: [] },
});

export const MemberPageQuerySchema = PaginationQuerySchema.extend({
  assignableToListId: TaskSchema.shape.primaryListId.optional().meta({
    title: 'Assignable to list',
    description: 'Only members with visibility through every ancestor of this list.',
    example: TaskSchema.shape.primaryListId.meta()?.example,
  }),
}).meta({
  title: 'Member page query',
  description:
    'Cursor pagination optionally limited to members who can be assigned in a visible list.',
  example: { limit: '50' },
});

export type CreateTask = z.infer<typeof CreateTaskSchema>;

export type UpdateTask = z.infer<typeof UpdateTaskSchema>;

export type ArchiveTask = z.infer<typeof ArchiveTaskSchema>;
