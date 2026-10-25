import { z } from 'zod';

import { FieldPatchSchema } from './field-values.js';
import { VersionSchema } from './identifiers.js';
import { TaskSchema } from './tasks.js';
import { ConfigVersionSchema } from './workspaces.js';

export const BulkTaskTargetSchema = z
  .strictObject({
    id: TaskSchema.shape.id,
    expectedVersion: VersionSchema.meta({
      title: 'Expected task version',
      description: 'Version of this selected task when the batch was prepared.',
      example: 1,
    }),
  })
  .meta({
    title: 'Bulk task target',
    description: 'One live task identity and its optimistic revision.',
    example: { id: '10000000-0000-4000-8000-000000000100', expectedVersion: 1 },
  });

export const BulkTaskPatchSchema = z
  .strictObject({
    statusId: TaskSchema.shape.statusId.optional(),
    priority: TaskSchema.shape.priority.optional(),
    assigneeIds: TaskSchema.shape.assigneeIds
      .refine((ids) => new Set(ids).size === ids.length, 'Assignee IDs must be unique')
      .optional(),
    customFields: FieldPatchSchema.optional(),
  })
  .refine(
    (patch) =>
      patch.statusId !== undefined ||
      patch.priority !== undefined ||
      patch.assigneeIds !== undefined ||
      (patch.customFields !== undefined && Object.keys(patch.customFields).length > 0),
    'At least one shared task change is required',
  )
  .meta({
    title: 'Shared task patch',
    description:
      'Apply supplied fields to every target. Empty assignments clear them; field null clears an optional value. Every resulting task must remain valid in its own list.',
    example: { priority: 'high' },
  });

export const BulkUpdateTasksSchema = z
  .strictObject({
    expectedConfigVersion: ConfigVersionSchema,
    tasks: z
      .array(BulkTaskTargetSchema)
      .min(1)
      .max(50)
      .refine(
        (tasks) => new Set(tasks.map((task) => task.id)).size === tasks.length,
        'Task IDs must be unique',
      )
      .meta({
        title: 'Selected tasks',
        description: 'Between one and fifty unique tasks, in the desired response order.',
        example: [{ id: '10000000-0000-4000-8000-000000000100', expectedVersion: 1 }],
      }),
    patch: BulkTaskPatchSchema,
  })
  .meta({
    title: 'Bulk update tasks request',
    description:
      'Atomically update selected live tasks in the active workspace. Any denied, stale or invalid target rejects the complete batch.',
    example: {
      expectedConfigVersion: 1,
      tasks: [{ id: '10000000-0000-4000-8000-000000000100', expectedVersion: 1 }],
      patch: { priority: 'high' },
    },
  });

export const BulkTaskMutationEnvelopeSchema = z
  .strictObject({
    data: z
      .array(TaskSchema)
      .min(1)
      .max(50)
      .refine(
        (tasks) => new Set(tasks.map((task) => task.id)).size === tasks.length,
        'Task IDs must be unique',
      )
      .meta({
        title: 'Resulting tasks',
        description: 'Safe task projections in the input order, including unchanged targets.',
        example: [TaskSchema.meta()?.example],
      }),
    configVersion: ConfigVersionSchema,
    dataVersion: VersionSchema.meta({
      title: 'Final workspace data version',
      description: 'Workspace data revision after all changed targets commit.',
      example: 2,
    }),
    changedTaskIds: z
      .array(TaskSchema.shape.id)
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, 'Changed task IDs must be unique')
      .meta({
        title: 'Changed task identities',
        description: 'Only targets actually changed; an all-no-op batch returns an empty array.',
        example: ['10000000-0000-4000-8000-000000000100'],
      }),
  })
  .refine(
    (result) => result.changedTaskIds.every((id) => result.data.some((task) => task.id === id)),
    'Changed task identities must occur in the response',
  )
  .meta({
    title: 'Bulk task update response',
    description:
      'Complete atomic batch result and final workspace revisions. There is no partial success response.',
    example: {
      data: [TaskSchema.meta()?.example],
      configVersion: 1,
      dataVersion: 2,
      changedTaskIds: ['10000000-0000-4000-8000-000000000100'],
    },
  });

export type BulkUpdateTasks = z.infer<typeof BulkUpdateTasksSchema>;

export type BulkTaskPatch = z.infer<typeof BulkTaskPatchSchema>;

export type BulkTaskMutationEnvelope = z.infer<typeof BulkTaskMutationEnvelopeSchema>;
