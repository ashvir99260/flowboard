import { z } from 'zod';

import { CalendarDateSchema, TimestampSchema } from './dates.js';
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

export const TaskUpdatedEventSchema = z.strictObject({
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
          before: CalendarDateSchema.nullable(),
          after: CalendarDateSchema.nullable(),
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
