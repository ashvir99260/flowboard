import { z } from 'zod';

import { TimestampSchema } from './dates.js';
import { PermissionModeSchema } from './enums.js';
import { UuidSchema } from './identifiers.js';
import { NodeParamsSchema, NodeSchema } from './nodes.js';
import { cursorPageSchema } from './pagination.js';
import { ConfigVersionSchema } from './workspaces.js';

export const PermissionExamples = {
  grant: {
    createdAt: '2026-10-24T10:00:00.000Z',
    mode: 'allow',
    resourceId: '10000000-0000-4000-8000-000000000010',
    updatedAt: '2026-10-24T10:00:00.000Z',
    userId: '10000000-0000-4000-8000-000000000003',
  },
  page: { items: [], configVersion: 1, pageInfo: { hasNextPage: false, nextCursor: null } },
};

export const GrantSchema = z
  .strictObject({
    resourceId: NodeSchema.shape.id,
    userId: UuidSchema.overwrite((value) => value.toLowerCase()).meta({
      description: 'Current member receiving the grant; never the acting identity.',
      example: '10000000-0000-4000-8000-000000000003',
      title: 'Target member ID',
    }),
    mode: PermissionModeSchema.meta({
      description: 'Deny blocks this subtree; allow satisfies privacy on this container only.',
      example: 'allow',
      title: 'Grant mode',
    }),
    createdAt: TimestampSchema.meta({
      description: 'Immutable grant creation time.',
      example: '2026-10-24T10:00:00.000Z',
      title: 'Created at',
    }),
    updatedAt: TimestampSchema.meta({
      description: 'Time of the last changed grant command.',
      example: '2026-10-24T10:00:00.000Z',
      title: 'Updated at',
    }),
  })
  .meta({
    title: 'Container grant',
    description: 'Explicit access for one current member and container.',
    example: {
      createdAt: '2026-10-24T10:00:00.000Z',
      mode: 'allow',
      resourceId: '10000000-0000-4000-8000-000000000010',
      updatedAt: '2026-10-24T10:00:00.000Z',
      userId: '10000000-0000-4000-8000-000000000003',
    },
  });

export const UpsertGrantSchema = GrantSchema.pick({ mode: true, userId: true })
  .extend({ expectedConfigVersion: ConfigVersionSchema })
  .meta({
    title: 'Set grant request',
    description: 'Admin-only grant change with workspace revision precondition.',
    example: {
      expectedConfigVersion: 1,
      mode: 'allow',
      userId: '10000000-0000-4000-8000-000000000003',
    },
  });

export const GrantParamsSchema = NodeParamsSchema.extend({ userId: GrantSchema.shape.userId }).meta(
  {
    title: 'Grant route parameters',
    description: 'Tenant container and current member.',
    example: {
      nodeId: '10000000-0000-4000-8000-000000000010',
      userId: '10000000-0000-4000-8000-000000000003',
    },
  },
);

export const GrantEnvelopeSchema = z
  .strictObject({ data: GrantSchema, configVersion: ConfigVersionSchema })
  .meta({
    title: 'Grant response',
    description: 'Persisted grant with current workspace configuration revision.',
    example: { data: PermissionExamples.grant, configVersion: 2 },
  });

export const GrantPageSchema = cursorPageSchema(GrantSchema)
  .extend({ configVersion: ConfigVersionSchema })
  .meta({
    title: 'Grant page',
    description: 'Admin-only grants ordered by creation time and user ID.',
    example: PermissionExamples.page,
  });

export type UpsertGrant = z.infer<typeof UpsertGrantSchema>;

export type Grant = z.infer<typeof GrantSchema>;

export type GrantEnvelope = z.infer<typeof GrantEnvelopeSchema>;

export type GrantPage = z.infer<typeof GrantPageSchema>;
