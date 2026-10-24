import { z } from 'zod';

import { refineFieldOptions } from './custom-fields.js';
import { FieldDefinitionSchema, FieldScopeSchema, ResolvedFieldSchema } from './fields.js';
import { ConfigVersionSchema } from './workspaces.js';

const shape = FieldDefinitionSchema.shape;
const writable = z.strictObject({
  key: shape.key,
  name: shape.name,
  type: shape.type,
  required: shape.required,
  options: shape.options,
  position: shape.position,
});

export const CreateScopeFieldSchema = writable
  .extend({ expectedConfigVersion: ConfigVersionSchema })
  .superRefine(refineFieldOptions)
  .meta({
    title: 'Create scoped field request',
    description: 'Complete local definition replacing any inherited definition of the same key.',
    example: {
      key: 'estimate',
      name: 'Estimate',
      type: 'number',
      required: false,
      options: [],
      position: 0,
      expectedConfigVersion: 1,
    },
  });

export const UpdateScopeFieldSchema = writable
  .omit({ key: true })
  .partial()
  .extend({ expectedConfigVersion: ConfigVersionSchema })
  .refine((value) => Object.keys(value).some((key) => key !== 'expectedConfigVersion'), {
    message: 'At least one field change is required',
  })
  .meta({
    title: 'Update scoped field request',
    description:
      'Non-null attributes to replace in a local definition. The complete resulting definition and live task values must remain valid.',
    example: { expectedConfigVersion: 1, name: 'Estimated effort' },
  });

export const ScopeFieldParamsSchema = FieldScopeSchema.extend({ fieldId: shape.id }).meta({
  title: 'Scoped field parameters',
  description: 'Exact local definition and owner in the active tenant.',
  example: { ...(FieldScopeSchema.meta()?.example as object), fieldId: shape.id.meta()?.example },
});

export const ListFieldParamsSchema = z
  .strictObject({
    listId: FieldScopeSchema.shape.ownerId.meta({
      description: 'Live list in the active workspace.',
      example: '20000000-0000-4000-8000-000000000010',
      title: 'List ID',
    }),
  })
  .meta({
    title: 'List field parameters',
    description: 'Target list identifier.',
    example: { listId: '20000000-0000-4000-8000-000000000010' },
  });

export const ScopeFieldCollectionSchema = z
  .strictObject({
    items: z.array(FieldDefinitionSchema).max(100).meta({
      title: 'Local fields',
      description: 'Complete local definitions ordered by position, key and ID.',
      example: [],
    }),
    ancestorScopes: z.array(FieldScopeSchema).max(3).meta({
      title: 'Ancestor scopes',
      description: 'Verified root-to-parent path excluding the requested owner.',
      example: [],
    }),
    configVersion: ConfigVersionSchema,
  })
  .meta({
    title: 'Scope field collection',
    description: 'Bounded local configuration and same-snapshot revision.',
    example: { items: [], ancestorScopes: [], configVersion: 1 },
  });

export const ResolvedFieldCollectionSchema = z
  .strictObject({
    items: z.array(ResolvedFieldSchema).max(100).meta({
      title: 'Resolved fields',
      description: 'Complete effective fields ordered by position, key and ID.',
      example: [],
    }),
    configVersion: ConfigVersionSchema,
  })
  .meta({
    title: 'Resolved field collection',
    description: 'Effective list schema with source metadata and same-snapshot revision.',
    example: { items: [ResolvedFieldSchema.meta()?.example], configVersion: 1 },
  });

export const ScopeFieldEnvelopeSchema = z
  .strictObject({ data: FieldDefinitionSchema, configVersion: ConfigVersionSchema })
  .meta({
    title: 'Scoped field response',
    description: 'Persisted local definition and committed workspace revision.',
    example: { data: FieldDefinitionSchema.meta()?.example, configVersion: 2 },
  });

export type CreateScopeField = z.infer<typeof CreateScopeFieldSchema>;

export type UpdateScopeField = z.infer<typeof UpdateScopeFieldSchema>;

export type FieldScope = z.infer<typeof FieldScopeSchema>;
