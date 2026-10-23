import { z } from 'zod';

import { TimestampSchema } from './dates.js';
import { UuidSchema, VersionSchema } from './identifiers.js';

export const RealtimeEvents = {
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
  changes: z.strictObject({
    assigneeIds: z.strictObject({ before: z.array(UuidSchema), after: z.array(UuidSchema) }),
  }),
});

export const WorkspaceConfigUpdatedEventSchema = z.strictObject({
  ...eventIdentity,
  configVersion: VersionSchema,
  reason: z.enum(['membership', 'invitation']),
});

export type TaskUpdatedEvent = z.infer<typeof TaskUpdatedEventSchema>;
