import { z } from 'zod';

import { CustomFieldOptionSchema, refineFieldOptions } from './custom-fields.js';
import { TimestampSchema } from './dates.js';
import { CustomFieldTypeSchema } from './enums.js';
import { ValidationIssueSchema } from './errors.js';
import { FieldKeySchema, NameSchema, PositionSchema, UuidSchema } from './identifiers.js';
import { StatusScopeSchema } from './statuses.js';

const uuid = UuidSchema.overwrite((value) => value.toLowerCase());
const audit = {
  createdAt: TimestampSchema.meta({
    description: 'Immutable definition creation timestamp.',
    example: '2026-10-24T00:00:00.000Z',
    title: 'Created at',
  }),
  updatedAt: TimestampSchema.meta({
    description: 'Timestamp of the last changed definition.',
    example: '2026-10-24T00:00:00.000Z',
    title: 'Updated at',
  }),
};

export const FieldScopeSchema = StatusScopeSchema.meta({
  title: 'Field scope',
  description: 'One verified configuration scope in the hierarchy.',
  example: StatusScopeSchema.meta()?.example,
});

export const FieldDefinitionSchema = FieldScopeSchema.extend({
  id: uuid.meta({
    description: 'Identity of this complete scoped definition.',
    example: '20000000-0000-4000-8000-000000000100',
    title: 'Field definition ID',
  }),
  workspaceId: uuid.meta({
    description: 'Tenant owning the definition.',
    example: '20000000-0000-4000-8000-000000000001',
    title: 'Workspace ID',
  }),
  key: FieldKeySchema.meta({
    description: 'Stable task-value key; nearest complete definition wins.',
    example: 'effort',
    title: 'Field key',
  }),
  name: NameSchema.meta({
    description: 'Human-readable display name.',
    example: 'Effort',
    title: 'Field name',
  }),
  type: CustomFieldTypeSchema.meta({
    description: 'Exact value type; values are never implicitly coerced.',
    example: 'number',
    title: 'Field type',
  }),
  required: z.boolean().meta({
    description: 'Every live task must supply a nonempty value of the declared type.',
    example: false,
    title: 'Required value',
  }),
  options: z.array(CustomFieldOptionSchema).max(100).meta({
    title: 'Select options',
    description: 'At most 100 unique option IDs for select fields; empty for other types.',
    example: [],
  }),
  position: PositionSchema.meta({
    description: 'Display order with key and ID ties.',
    example: 0,
    title: 'Field position',
  }),
  ...audit,
})
  .superRefine((field, ctx) => {
    refineFieldOptions(field, ctx);
    if (field.ownerType === 'workspace' && field.ownerId !== field.workspaceId)
      ctx.addIssue({
        code: 'custom',
        message: 'Workspace owner must match its tenant',
        path: ['ownerId'],
      });
  })
  .meta({
    title: 'Custom field definition',
    description: 'Complete scoped field definition with immutable identity and audit timestamps.',
    example: {
      id: '20000000-0000-4000-8000-000000000100',
      workspaceId: '20000000-0000-4000-8000-000000000001',
      ownerType: 'workspace',
      ownerId: '20000000-0000-4000-8000-000000000001',
      key: 'effort',
      name: 'Effort',
      type: 'number',
      required: false,
      options: [],
      position: 0,
      createdAt: '2026-10-24T00:00:00.000Z',
      updatedAt: '2026-10-24T00:00:00.000Z',
    },
  });

export const FieldSourceSchema = FieldScopeSchema.extend({
  fieldId: FieldDefinitionSchema.shape.id,
  ...audit,
}).meta({
  title: 'Field source',
  description: 'The exact complete definition supplying every resolved attribute.',
  example: {
    createdAt: '2026-10-24T00:00:00.000Z',
    fieldId: '20000000-0000-4000-8000-000000000100',
    ownerId: '20000000-0000-4000-8000-000000000001',
    ownerType: 'workspace',
    updatedAt: '2026-10-24T00:00:00.000Z',
  },
});

export const ResolvedFieldSchema = FieldDefinitionSchema.safeExtend({
  source: FieldSourceSchema,
  isInherited: z.boolean().meta({
    description: 'The winning definition belongs to an ancestor of the requested scope.',
    example: true,
    title: 'Inherited field',
  }),
}).meta({
  title: 'Resolved custom field',
  description: 'Nearest full definition with its exact source and inheritance indicator.',
  example: {
    ...(FieldDefinitionSchema.meta()?.example as object),
    source: FieldSourceSchema.meta()?.example,
    isInherited: true,
  },
});

export const FieldResolutionInputSchema = z.strictObject({
  scopes: z.array(FieldScopeSchema).min(1).max(4),
  definitions: z.array(FieldDefinitionSchema),
});

export const FieldResolutionResultSchema = z.discriminatedUnion('success', [
  z.strictObject({ success: z.literal(true), items: z.array(ResolvedFieldSchema).max(100) }),
  z.strictObject({ success: z.literal(false), issues: z.array(ValidationIssueSchema).min(1) }),
]);

export type FieldDefinition = z.infer<typeof FieldDefinitionSchema>;

export type ResolvedField = z.infer<typeof ResolvedFieldSchema>;

export type FieldResolutionResult = z.infer<typeof FieldResolutionResultSchema>;

export type FieldResolutionInput = {
  readonly definitions: readonly FieldDefinition[];
  readonly scopes: readonly z.infer<typeof FieldScopeSchema>[];
};
