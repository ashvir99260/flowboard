import { z } from 'zod';

import {
  ResolvedStatusSchema,
  StatusIdentitySchema,
  StatusOverrideSchema,
  StatusScopeSchema,
} from './statuses.js';
import { ConfigVersionSchema } from './workspaces.js';

export const ScopeStatusSchema = z
  .strictObject({
    identity: StatusIdentitySchema,
    override: StatusOverrideSchema,
  })
  .meta({
    title: 'Local status configuration',
    description: 'Canonical identity and distinct local display row.',
    example: {
      identity: StatusIdentitySchema.meta()?.example,
      override: StatusOverrideSchema.meta()?.example,
    },
  });

export const ScopeStatusCollectionSchema = z
  .strictObject({
    items: z.array(ScopeStatusSchema).max(100).meta({
      title: 'Local statuses',
      description: 'Complete bounded local configuration, ordered by key.',
      example: [],
    }),
    ancestorScopes: z.array(StatusScopeSchema).max(3).meta({
      title: 'Ancestor scopes',
      description: 'Verified root-to-parent path; excludes the requested owner.',
      example: [],
    }),
    configVersion: ConfigVersionSchema,
  })
  .meta({
    title: 'Scope status collection',
    description: 'Complete local configuration and same-snapshot revision.',
    example: { items: [], ancestorScopes: [], configVersion: 1 },
  });

export const ResolvedStatusCollectionSchema = z
  .strictObject({
    items: z
      .array(ResolvedStatusSchema)
      .max(100)
      .meta({
        title: 'Resolved statuses',
        description: 'Complete visible statuses ordered by position, key and ID.',
        example: [ResolvedStatusSchema.meta()?.example],
      }),
    configVersion: ConfigVersionSchema,
  })
  .meta({
    title: 'Resolved status collection',
    description: 'Effective list configuration and same-snapshot revision.',
    example: { items: [ResolvedStatusSchema.meta()?.example], configVersion: 1 },
  });

export const ListStatusParamsSchema = z
  .strictObject({
    listId: StatusScopeSchema.shape.ownerId.meta({
      description: 'Live list in the active workspace.',
      example: '20000000-0000-4000-8000-000000000010',
      title: 'List ID',
    }),
  })
  .meta({
    title: 'List status parameters',
    description: 'Target list identifier.',
    example: { listId: '20000000-0000-4000-8000-000000000010' },
  });

export type ScopeStatus = z.infer<typeof ScopeStatusSchema>;

export type ScopeStatusCollection = z.infer<typeof ScopeStatusCollectionSchema>;

export type ResolvedStatusCollection = z.infer<typeof ResolvedStatusCollectionSchema>;

const mutable = StatusOverrideSchema.pick({
  color: true,
  hidden: true,
  name: true,
  position: true,
}).partial();
const expected = { expectedConfigVersion: ConfigVersionSchema };
const requireChange = (value: object) =>
  ['name', 'color', 'position', 'hidden'].some((key) => Object.hasOwn(value, key));

export const CreateScopeStatusSchema = z
  .discriminatedUnion('kind', [
    StatusIdentitySchema.pick({ category: true, key: true }).extend({
      kind: z.literal('define').meta({
        description: 'Introduce a status with complete display values.',
        example: 'define',
        title: 'Definition command',
      }),
      name: ResolvedStatusSchema.shape.name,
      color: ResolvedStatusSchema.shape.color,
      position: ResolvedStatusSchema.shape.position,
      ...expected,
    }),
    mutable
      .extend({
        kind: z.literal('override').meta({
          description: 'Configure an inherited canonical identity, including hidden identities.',
          example: 'override',
          title: 'Override command',
        }),
        statusId: StatusIdentitySchema.shape.id,
        ...expected,
      })
      .refine(requireChange, { message: 'At least one display or visibility change is required' }),
  ])
  .meta({
    title: 'Create scoped status request',
    description: 'Define a complete local status or override one inherited identity.',
    example: {
      category: 'active',
      color: '#334455',
      expectedConfigVersion: 1,
      key: 'review',
      kind: 'define',
      name: 'Review',
      position: 1,
    },
  });

export const UpdateScopeStatusSchema = mutable
  .extend(expected)
  .refine(requireChange, { message: 'At least one display or visibility change is required' })
  .meta({
    title: 'Update scoped status request',
    description: 'Patch an existing local row; null inherits and omission preserves its value.',
    example: { expectedConfigVersion: 1, name: 'Reviewing' },
  });

export const ScopeStatusParamsSchema = StatusScopeSchema.extend({
  statusId: StatusIdentitySchema.shape.id,
}).meta({
  title: 'Scoped status parameters',
  description: 'Local configuration identified by owner and canonical status ID.',
  example: {
    ownerId: '20000000-0000-4000-8000-000000000010',
    ownerType: 'list',
    statusId: '20000000-0000-4000-8000-000000000100',
  },
});

export const ScopeStatusEnvelopeSchema = z
  .strictObject({ data: ScopeStatusSchema, configVersion: ConfigVersionSchema })
  .meta({
    title: 'Scoped status response',
    description: 'Persisted local configuration and committed workspace revision.',
    example: { data: ScopeStatusSchema.meta()?.example, configVersion: 2 },
  });

export type CreateScopeStatus = z.infer<typeof CreateScopeStatusSchema>;

export type UpdateScopeStatus = z.infer<typeof UpdateScopeStatusSchema>;
