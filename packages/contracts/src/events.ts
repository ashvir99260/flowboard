import { z } from 'zod';

import { TaskDueDateSchema, TimestampSchema } from './dates.js';
import { PrioritySchema } from './enums.js';
import { FieldKeySchema, PositionSchema, UuidSchema, VersionSchema } from './identifiers.js';

export const RealtimeEvents = {
  nodeUpdated: 'node.updated',
  taskCreated: 'task.created',
  taskUpdated: 'task.updated',
  workspaceConfigUpdated: 'workspace.config.updated',
} as const;

const eventIdentity = {
  eventId: UuidSchema,
  workspaceId: UuidSchema,
  actorId: UuidSchema,
  schemaVersion: z.literal(1),
  occurredAt: TimestampSchema,
};

export const TaskUpdatedEventSchema = z
  .strictObject({
    ...eventIdentity,
    taskId: UuidSchema,
    taskVersion: VersionSchema,
    previousListId: UuidSchema,
    currentListId: UuidSchema,
    changes: z
      .strictObject({
        primaryListId: z.strictObject({ before: UuidSchema, after: UuidSchema }).optional(),
        assigneeIds: z
          .strictObject({ before: z.array(UuidSchema), after: z.array(UuidSchema) })
          .optional(),
        archivedAt: z.strictObject({ before: z.null(), after: TimestampSchema }).optional(),
        statusId: z.strictObject({ before: UuidSchema, after: UuidSchema }).optional(),
        priority: z.strictObject({ before: PrioritySchema, after: PrioritySchema }).optional(),
        dueDate: z
          .strictObject({
            before: TaskDueDateSchema.nullable(),
            after: TaskDueDateSchema.nullable(),
          })
          .optional(),
        position: z.strictObject({ before: PositionSchema, after: PositionSchema }).optional(),
        title: z.literal(true).optional(),
        description: z.literal(true).optional(),
        customFieldKeys: z.array(FieldKeySchema).min(1).optional(),
      })
      .refine(
        (value) => Object.values(value).some((item) => item !== undefined),
        'A task event must describe a change',
      ),
  })
  .superRefine((event, context) => {
    const previous = event.previousListId.toLowerCase();
    const current = event.currentListId.toLowerCase();
    const movement = event.changes.primaryListId;
    if (
      (previous !== current) !== Boolean(movement) ||
      (movement &&
        (movement.before.toLowerCase() !== previous || movement.after.toLowerCase() !== current))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['changes', 'primaryListId'],
        message: 'List change must agree with the event source and destination',
      });
    }

    const status = event.changes.statusId;
    if (status && status.before.toLowerCase() === status.after.toLowerCase())
      context.addIssue({
        code: 'custom',
        path: ['changes', 'statusId'],
        message: 'Status change must use different identities',
      });
  });

export const WorkspaceConfigUpdatedEventSchema = z.strictObject({
  ...eventIdentity,
  configVersion: VersionSchema,
  reason: z.enum(['membership', 'invitation', 'hierarchy', 'permission', 'status', 'field']),
});

export type TaskUpdatedEvent = z.infer<typeof TaskUpdatedEventSchema>;

export const NodeUpdatedEventSchema = z.strictObject({
  ...eventIdentity,
  nodeId: UuidSchema,
  nodeVersion: VersionSchema,
  operation: z.enum(['created', 'updated', 'archived']),
});

export const TaskCreatedEventSchema = z.strictObject({
  ...eventIdentity,
  taskId: UuidSchema,
  taskVersion: VersionSchema,
  currentListId: UuidSchema,
  statusId: UuidSchema,
});

export type TaskCreatedEvent = z.infer<typeof TaskCreatedEventSchema>;
