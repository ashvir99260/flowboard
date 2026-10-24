import { z } from 'zod';

import { TimestampSchema } from './dates.js';
import { UuidSchema, VersionSchema } from './identifiers.js';

export const RealtimeEvents = {
  nodeUpdated: 'node.updated',
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
  changes: z.union([
    z.strictObject({
      assigneeIds: z.strictObject({ before: z.array(UuidSchema), after: z.array(UuidSchema) }),
    }),
    z.strictObject({ archivedAt: z.strictObject({ before: z.null(), after: TimestampSchema }) }),
  ]),
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
