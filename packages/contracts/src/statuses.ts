import { z } from 'zod';

import { TimestampSchema } from './dates.js';
import { ScopeTypeSchema, StatusCategorySchema } from './enums.js';
import { ValidationIssueSchema } from './errors.js';
import {
  ColorSchema,
  FieldKeySchema,
  NameSchema,
  PositionSchema,
  UuidSchema,
} from './identifiers.js';

const uuid = UuidSchema.overwrite((value) => value.toLowerCase());
const audit = {
  createdAt: TimestampSchema.meta({
    description: 'Immutable database creation timestamp.',
    example: '2026-10-24T00:00:00.000Z',
    title: 'Created at',
  }),
  updatedAt: TimestampSchema.meta({
    description: 'Database timestamp of the last changed write.',
    example: '2026-10-24T00:00:00.000Z',
    title: 'Updated at',
  }),
};

export const StatusScopeSchema = z
  .strictObject({
    ownerType: ScopeTypeSchema.meta({
      description: 'Workspace or a live hierarchy container.',
      example: 'workspace',
      title: 'Owner type',
    }),
    ownerId: uuid.meta({
      description: 'Identifier of the owning workspace or container.',
      example: '20000000-0000-4000-8000-000000000001',
      title: 'Owner ID',
    }),
  })
  .meta({
    title: 'Status scope',
    description: 'One verified scope in an ancestor path.',
    example: { ownerId: '20000000-0000-4000-8000-000000000001', ownerType: 'workspace' },
  });

export const StatusIdentitySchema = z
  .strictObject({
    id: uuid.meta({
      description: 'Stable identity referenced by tasks; never an override-row ID.',
      example: '20000000-0000-4000-8000-000000000100',
      title: 'Status ID',
    }),
    workspaceId: uuid.meta({
      description: 'Tenant owning the immutable status key and category.',
      example: '20000000-0000-4000-8000-000000000001',
      title: 'Workspace ID',
    }),
    key: FieldKeySchema.meta({
      description: 'Immutable workspace-unique key.',
      example: 'todo',
      title: 'Status key',
    }),
    category: StatusCategorySchema.meta({
      description: 'Immutable behavior category of this identity.',
      example: 'not_started',
      title: 'Status category',
    }),
    ...audit,
  })
  .meta({
    title: 'Status identity',
    description: 'Canonical status identity shared by inherited display overrides.',
    example: {
      category: 'not_started',
      createdAt: '2026-10-24T00:00:00.000Z',
      id: '20000000-0000-4000-8000-000000000100',
      key: 'todo',
      updatedAt: '2026-10-24T00:00:00.000Z',
      workspaceId: '20000000-0000-4000-8000-000000000001',
    },
  });

export const StatusOverrideSchema = StatusScopeSchema.extend({
  id: uuid.meta({
    description: 'Display configuration row ID; never a task statusId.',
    example: '20000000-0000-4000-8000-000000000200',
    title: 'Override row ID',
  }),
  workspaceId: StatusIdentitySchema.shape.workspaceId,
  statusId: StatusIdentitySchema.shape.id,
  name: NameSchema.nullable().meta({
    description: 'Null inherits; first introduction requires a name.',
    example: 'To do',
    title: 'Display name',
  }),
  color: ColorSchema.nullable().meta({
    description: 'Null inherits; first introduction requires a hexadecimal color.',
    example: '#334455',
    title: 'Display color',
  }),
  position: PositionSchema.nullable().meta({
    description: 'Null inherits; zero is a valid explicit position.',
    example: 0,
    title: 'Display position',
  }),
  hidden: z.boolean().nullable().meta({
    description: 'Null inherits; true hides; false explicitly restores visibility.',
    example: null,
    title: 'Hidden override',
  }),
  ...audit,
}).meta({
  title: 'Status override',
  description: 'Partial scoped display and visibility configuration for a stable identity.',
  example: {
    color: '#334455',
    createdAt: '2026-10-24T00:00:00.000Z',
    hidden: null,
    id: '20000000-0000-4000-8000-000000000200',
    name: 'To do',
    ownerId: '20000000-0000-4000-8000-000000000001',
    ownerType: 'workspace',
    position: 0,
    statusId: '20000000-0000-4000-8000-000000000100',
    updatedAt: '2026-10-24T00:00:00.000Z',
    workspaceId: '20000000-0000-4000-8000-000000000001',
  },
});

export const StatusSourceSchema = StatusScopeSchema.extend({
  overrideId: StatusOverrideSchema.shape.id,
  ...audit,
}).meta({
  title: 'Status attribute source',
  description: 'Exact override row supplying an effective attribute.',
  example: {
    createdAt: '2026-10-24T00:00:00.000Z',
    overrideId: '20000000-0000-4000-8000-000000000200',
    ownerId: '20000000-0000-4000-8000-000000000001',
    ownerType: 'workspace',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
});

const sourceExample = {
  createdAt: '2026-10-24T00:00:00.000Z',
  overrideId: '20000000-0000-4000-8000-000000000200',
  ownerId: '20000000-0000-4000-8000-000000000001',
  ownerType: 'workspace',
  updatedAt: '2026-10-24T00:00:00.000Z',
};
const provenanceExample = {
  name: sourceExample,
  color: sourceExample,
  position: sourceExample,
  hidden: null,
};
const resolvedExample = {
  id: '20000000-0000-4000-8000-000000000100',
  workspaceId: '20000000-0000-4000-8000-000000000001',
  key: 'todo',
  category: 'not_started',
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
  name: 'To do',
  color: '#334455',
  position: 0,
  sourceOwner: { ownerId: '20000000-0000-4000-8000-000000000001', ownerType: 'workspace' },
  isInherited: true,
  isLocal: false,
  isOverridden: false,
  provenance: provenanceExample,
};

export const ResolvedStatusSchema = StatusIdentitySchema.extend({
  name: NameSchema.meta({
    description: 'Nearest nonnull display name.',
    example: 'To do',
    title: 'Resolved name',
  }),
  color: ColorSchema.meta({
    description: 'Nearest nonnull hexadecimal color.',
    example: '#334455',
    title: 'Resolved color',
  }),
  position: PositionSchema.meta({
    description: 'Nearest nonnull position; key and ID break ties.',
    example: 0,
    title: 'Resolved position',
  }),
  sourceOwner: StatusScopeSchema,
  isInherited: z.boolean().meta({
    description: 'The first introduction in this path is above the target scope.',
    example: true,
    title: 'Inherited identity',
  }),
  isLocal: z.boolean().meta({
    description: 'The target scope has a row for this identity, including a partial override.',
    example: false,
    title: 'Local configuration',
  }),
  isOverridden: z.boolean().meta({
    description: 'A later row explicitly supplies an attribute or visibility value.',
    example: false,
    title: 'Overridden attributes',
  }),
  provenance: z
    .strictObject({
      name: StatusSourceSchema,
      color: StatusSourceSchema,
      position: StatusSourceSchema,
      hidden: StatusSourceSchema.nullable().meta({
        description: 'Null means implicit initially-visible behavior.',
        example: null,
        title: 'Visibility source',
      }),
    })
    .meta({
      title: 'Resolved attribute provenance',
      description: 'Each attribute retains its actual source and audit timestamps.',
      example: provenanceExample,
    }),
}).meta({
  title: 'Resolved status',
  description:
    'Visible effective status with canonical identity audit timestamps and explicit display provenance.',
  example: resolvedExample,
});

export const StatusResolutionInputSchema = z.strictObject({
  scopes: z.array(StatusScopeSchema).min(1).max(4),
  identities: z.array(StatusIdentitySchema),
  overrides: z.array(StatusOverrideSchema),
});

export const StatusResolutionResultSchema = z.discriminatedUnion('success', [
  z.strictObject({ success: z.literal(true), items: z.array(ResolvedStatusSchema).max(100) }),
  z.strictObject({ success: z.literal(false), issues: z.array(ValidationIssueSchema).min(1) }),
]);

export type StatusScope = z.infer<typeof StatusScopeSchema>;

export type StatusIdentity = z.infer<typeof StatusIdentitySchema>;

export type StatusOverride = z.infer<typeof StatusOverrideSchema>;

export type ResolvedStatus = z.infer<typeof ResolvedStatusSchema>;

export type StatusResolutionResult = z.infer<typeof StatusResolutionResultSchema>;

export type StatusResolutionInput = {
  readonly identities: readonly StatusIdentity[];
  readonly overrides: readonly StatusOverride[];
  readonly scopes: readonly StatusScope[];
};
