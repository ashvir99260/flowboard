import { z } from 'zod';

import { TimestampSchema } from './dates.js';
import { NameSchema, UuidSchema, VersionSchema } from './identifiers.js';
import { cursorPageSchema, PaginationQuerySchema } from './pagination.js';

const id = (n: number) => `81000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const meta = (title: string, description: string, example: unknown) => ({
  title,
  description,
  example,
});

export const StatusActivityPayloadSchema = z
  .strictObject({
    beforeStatusId: UuidSchema.meta(
      meta('Previous status ID', 'Canonical status before this event.', id(6)),
    ),
    afterStatusId: UuidSchema.meta(
      meta('Current status ID', 'Canonical status after this event.', id(7)),
    ),
    occurredAt: TimestampSchema.meta(
      meta('Event time', 'Time of the original committed task change.', '2026-10-24T10:00:00.000Z'),
    ),
    taskVersion: VersionSchema.meta(
      meta('Task version', 'Task revision produced by the original change.', 2),
    ),
  })
  .refine(
    (value) => value.beforeStatusId !== value.afterStatusId,
    'Status activity must describe a change',
  )
  .meta(
    meta(
      'Status activity details',
      'Verified status identities and original event metadata; display labels may change later.',
      {
        beforeStatusId: id(6),
        afterStatusId: id(7),
        occurredAt: '2026-10-24T10:00:00.000Z',
        taskVersion: 2,
      },
    ),
  );

export const ActivityActorSchema = z
  .strictObject({
    id: UuidSchema.meta(
      meta('Actor ID', 'Original user identity, retained after membership removal.', id(5)),
    ),
    name: NameSchema.meta(
      meta(
        'Actor name',
        'Current public display name without account credentials or email.',
        'Alice',
      ),
    ),
  })
  .meta(
    meta('Activity actor', 'Safe summary of the user who made the change.', {
      id: id(5),
      name: 'Alice',
    }),
  );

export const ActivitySchema = z
  .strictObject({
    id: UuidSchema.meta(meta('Activity ID', 'Stable feed-entry identity.', id(1))),
    workspaceId: UuidSchema.meta(meta('Workspace ID', 'Tenant owning the activity.', id(2))),
    taskId: UuidSchema.meta(meta('Task ID', 'Task whose visible feed contains this entry.', id(3))),
    eventId: UuidSchema.meta(
      meta('Event ID', 'Original committed event; unique across retries.', id(4)),
    ),
    actor: ActivityActorSchema,
    type: z
      .literal('task.status_changed')
      .meta(meta('Activity type', 'Supported feed-entry discriminator.', 'task.status_changed')),
    payload: StatusActivityPayloadSchema,
    createdAt: TimestampSchema.meta(
      meta(
        'Created at',
        'Server-assigned activity insertion time used for feed ordering.',
        '2026-10-24T10:00:01.000Z',
      ),
    ),
    updatedAt: TimestampSchema.meta(
      meta(
        'Updated at',
        'Server-maintained audit timestamp; retrying insertion does not change it.',
        '2026-10-24T10:00:01.000Z',
      ),
    ),
  })
  .meta(
    meta('Task activity', 'Authorized status-change feed entry with a safe actor summary.', {
      id: id(1),
      workspaceId: id(2),
      taskId: id(3),
      eventId: id(4),
      actor: ActivityActorSchema.meta()?.example,
      type: 'task.status_changed',
      payload: StatusActivityPayloadSchema.meta()?.example,
      createdAt: '2026-10-24T10:00:01.000Z',
      updatedAt: '2026-10-24T10:00:01.000Z',
    }),
  );

export const ActivityQuerySchema = PaginationQuerySchema.meta(
  meta('Activity query', 'Cursor-only page in descending creation-time and ID order.', {
    limit: '50',
  }),
);

export const ActivityPageSchema = cursorPageSchema(ActivitySchema).meta(
  meta('Task activity page', 'Authorized feed entries below a fixed first-page upper watermark.', {
    items: [],
    pageInfo: { hasNextPage: false, nextCursor: null },
  }),
);

export type Activity = z.infer<typeof ActivitySchema>;

export type StatusActivityPayload = z.infer<typeof StatusActivityPayloadSchema>;

export type ActivityPage = z.infer<typeof ActivityPageSchema>;

export type ActivityQuery = z.infer<typeof ActivityQuerySchema>;
