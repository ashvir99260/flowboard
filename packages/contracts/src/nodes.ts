import { z } from 'zod';

import { TimestampSchema } from './dates.js';
import { ContainerTypeSchema, VisibilitySchema } from './enums.js';
import { NameSchema, PositionSchema, UuidSchema, VersionSchema } from './identifiers.js';
import { ConfigVersionSchema } from './workspaces.js';

export const ContainerParentType = { folder: 'space', list: 'folder', space: null } as const;

export const NodeExamples = {
  node: {
    archivedAt: null,
    createdAt: '2026-10-24T10:00:00.000Z',
    id: '10000000-0000-4000-8000-000000000010',
    name: 'Engineering',
    parentId: null,
    position: 0,
    type: 'space',
    updatedAt: '2026-10-24T10:00:00.000Z',
    version: 1,
    visibility: 'public',
    workspaceId: '10000000-0000-4000-8000-000000000002',
  },
  create: {
    expectedConfigVersion: 1,
    name: 'Engineering',
    parentId: null,
    type: 'space',
    visibility: 'public',
  },
};

export const NodeSchema = z
  .strictObject({
    id: UuidSchema.meta({
      title: 'Node ID',
      description: 'Server-generated container identifier.',
      example: NodeExamples.node.id,
    }),
    workspaceId: UuidSchema.meta({
      title: 'Workspace ID',
      description: 'Tenant owning this container, resolved from the authenticated session.',
      example: NodeExamples.node.workspaceId,
    }),
    name: NameSchema.meta({
      description: 'Trimmed name containing 1 to 120 Unicode characters.',
      example: 'Engineering',
      title: 'Container name',
    }),
    type: ContainerTypeSchema.meta({
      description: 'A space contains folders; a folder contains lists; lists contain tasks.',
      example: 'space',
      title: 'Container type',
    }),
    parentId: UuidSchema.nullable().meta({
      description: 'Null for spaces; a space ID for folders; a folder ID for lists.',
      example: null,
      title: 'Parent ID',
    }),
    position: PositionSchema.meta({
      description: 'Server-assigned position among live siblings.',
      example: 0,
      title: 'Sibling position',
    }),
    visibility: VisibilitySchema.meta({
      description:
        'Container visibility policy; private access requires an explicit grant for members.',
      example: 'public',
      title: 'Visibility',
    }),
    version: VersionSchema.meta({
      description: 'Optimistic revision incremented by each changed command.',
      example: 1,
      title: 'Node version',
    }),
    archivedAt: TimestampSchema.nullable().meta({
      description: 'Server archive timestamp or null for a live container.',
      example: null,
      title: 'Archived at',
    }),
    createdAt: TimestampSchema.meta({
      title: 'Created at',
      description: 'Immutable creation time from the database clock.',
      example: NodeExamples.node.createdAt,
    }),
    updatedAt: TimestampSchema.meta({
      title: 'Updated at',
      description: 'Database-maintained time of the last changed command.',
      example: NodeExamples.node.updatedAt,
    }),
  })
  .meta({
    title: 'Container',
    description: 'Safe tenant-owned hierarchy container.',
    example: NodeExamples.node,
  });

export const NodeParamsSchema = z
  .strictObject({
    nodeId: NodeSchema.shape.id
      .overwrite((value) => value.toLowerCase())
      .meta({
        title: 'Target node ID',
        description: 'Container identifier within the selected workspace.',
        example: NodeExamples.node.id,
      }),
  })
  .meta({
    title: 'Node route parameters',
    description: 'Tenant-scoped container target.',
    example: { nodeId: NodeExamples.node.id },
  });

export const CreateNodeSchema = z
  .strictObject({
    name: NodeSchema.shape.name,
    type: NodeSchema.shape.type,
    parentId: NodeSchema.shape.parentId,
    visibility: NodeSchema.shape.visibility.default('public'),
    expectedConfigVersion: ConfigVersionSchema,
  })
  .meta({
    title: 'Create container request',
    description:
      'Append a container under a valid live parent; positions and identity are server-owned.',
    example: NodeExamples.create,
  });

export const NodeEnvelopeSchema = z
  .strictObject({
    data: NodeSchema,
    configVersion: ConfigVersionSchema,
    dataVersion: VersionSchema.meta({
      description: 'Workspace collection revision from the same database snapshot.',
      example: 2,
      title: 'Data version',
    }),
  })
  .meta({
    title: 'Container response',
    description: 'Container and workspace revisions from one transaction.',
    example: { data: NodeExamples.node, configVersion: 2, dataVersion: 2 },
  });

export type CreateNode = z.infer<typeof CreateNodeSchema>;

export type NodeEnvelope = z.infer<typeof NodeEnvelopeSchema>;

export const NodeVersionSchema = z
  .strictObject({
    expectedConfigVersion: ConfigVersionSchema,
    expectedVersion: NodeSchema.shape.version.meta({
      description: 'Last observed node revision; a stale revision is a conflict.',
      example: 1,
      title: 'Expected node version',
    }),
  })
  .meta({
    title: 'Node mutation preconditions',
    description: 'Both node and workspace revisions are required.',
    example: { expectedConfigVersion: 2, expectedVersion: 1 },
  });

export const UpdateNodeSchema = NodeVersionSchema.extend({
  name: NodeSchema.shape.name.optional(),
  visibility: NodeSchema.shape.visibility.optional(),
})
  .refine((value) => value.name !== undefined || value.visibility !== undefined, {
    message: 'Provide name or visibility',
    path: ['name'],
  })
  .meta({
    title: 'Update container request',
    description: 'Change name or visibility; type, parent and position cannot be changed here.',
    example: { expectedConfigVersion: 2, expectedVersion: 1, name: 'Engineering team' },
  });

export type UpdateNode = z.infer<typeof UpdateNodeSchema>;

export type NodeVersion = z.infer<typeof NodeVersionSchema>;
