import { z } from 'zod';

import {
  NodeUpdatedEventSchema,
  TaskCreatedEventSchema,
  TaskUpdatedEventSchema,
  WorkspaceConfigUpdatedEventSchema,
} from './events.js';
import { UuidSchema, VersionSchema } from './identifiers.js';

export const EventQueueName = 'flowboard-events';

export const EventJobName = 'event';

export const EventChannelName = 'flowboard:events';

export const EventJobReferenceSchema = z.strictObject({
  schemaVersion: z.literal(1),
  eventId: UuidSchema,
  workspaceId: UuidSchema,
});

const record = z.strictObject({
  id: UuidSchema,
  workspaceId: UuidSchema,
  actorId: UuidSchema,
  aggregateId: UuidSchema,
  aggregateVersion: VersionSchema,
  schemaVersion: z.literal(1),
});

export const OutboxRecordSchema = z
  .discriminatedUnion('eventType', [
    record.extend({
      eventType: z.literal('task.created'),
      aggregateType: z.literal('task'),
      payload: TaskCreatedEventSchema,
    }),
    record.extend({
      eventType: z.literal('task.updated'),
      aggregateType: z.literal('task'),
      payload: TaskUpdatedEventSchema,
    }),
    record.extend({
      eventType: z.literal('node.updated'),
      aggregateType: z.literal('node'),
      payload: NodeUpdatedEventSchema,
    }),
    record.extend({
      eventType: z.literal('workspace.config.updated'),
      aggregateType: z.literal('workspace_config'),
      payload: WorkspaceConfigUpdatedEventSchema,
    }),
  ])
  .superRefine((value, context) => {
    const payload = value.payload;
    const aggregateId =
      'taskId' in payload
        ? payload.taskId
        : 'nodeId' in payload
          ? payload.nodeId
          : payload.workspaceId;
    const version =
      'taskVersion' in payload
        ? payload.taskVersion
        : 'nodeVersion' in payload
          ? payload.nodeVersion
          : payload.configVersion;
    const matches = [
      ['eventId', payload.eventId === value.id],
      ['workspaceId', payload.workspaceId === value.workspaceId],
      ['actorId', payload.actorId === value.actorId],
      ['schemaVersion', payload.schemaVersion === value.schemaVersion],
      ['aggregateId', aggregateId === value.aggregateId],
      ['aggregateVersion', version === value.aggregateVersion],
    ] as const;
    for (const [field, valid] of matches)
      if (!valid)
        context.addIssue({
          code: 'custom',
          path: ['payload', field],
          message: 'Event payload does not match its persisted identity',
        });
  });

export type EventJobReference = z.infer<typeof EventJobReferenceSchema>;

export type OutboxRecord = z.infer<typeof OutboxRecordSchema>;
