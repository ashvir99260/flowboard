import { z } from 'zod';

import { UuidSchema } from './identifiers.js';
import { NodeVersionSchema } from './nodes.js';

const anchor = UuidSchema.overwrite((value) => value.toLowerCase()).meta({
  description: 'A distinct live sibling in the selected workspace.',
  example: '10000000-0000-4000-8000-000000000010',
  title: 'Sibling anchor ID',
});

export const PlacementSchema = z
  .union([
    z
      .strictObject({
        edge: z.enum(['start', 'end']).meta({
          description: 'Place before all siblings or after all siblings.',
          example: 'start',
          title: 'Placement edge',
        }),
      })
      .meta({
        title: 'Edge placement',
        description: 'Absolute position in the sibling collection.',
        example: { edge: 'start' },
      }),
    z.strictObject({ beforeId: anchor }).meta({
      title: 'Before placement',
      description: 'Place immediately before a sibling.',
      example: { beforeId: '10000000-0000-4000-8000-000000000010' },
    }),
    z.strictObject({ afterId: anchor }).meta({
      title: 'After placement',
      description: 'Place immediately after a sibling.',
      example: { afterId: '10000000-0000-4000-8000-000000000010' },
    }),
  ])
  .meta({
    title: 'Sibling placement',
    description:
      'Exactly one edge or one sibling anchor. Numeric positions and multiple anchors are rejected.',
    example: { edge: 'start' },
  });

export const ReorderNodeSchema = NodeVersionSchema.extend({ placement: PlacementSchema }).meta({
  title: 'Reorder container request',
  description: 'Move within the existing parent using current node and workspace revisions.',
  example: { expectedVersion: 1, expectedConfigVersion: 1, placement: { edge: 'start' } },
});

export type Placement = z.infer<typeof PlacementSchema>;

export type ReorderNode = z.infer<typeof ReorderNodeSchema>;
