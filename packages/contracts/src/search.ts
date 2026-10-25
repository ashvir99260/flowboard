import { z } from 'zod';

import { NameSchema, TitleSchema, UuidSchema } from './identifiers.js';
import { cursorPageSchema, PaginationQuerySchema } from './pagination.js';
import { ListTasksQuerySchema, TaskPageSchema } from './tasks.js';

export const SearchWorkspaceQuerySchema = PaginationQuerySchema.extend({
  q: ListTasksQuerySchema.shape.q.unwrap().meta({
    description:
      'Required word or quoted-phrase search across visible task titles, descriptions and list names.',
    example: 'release notes',
    title: 'Workspace search text',
  }),
}).meta({
  title: 'Workspace search query',
  description: 'Search the active workspace with bounded text and forward-only cursor pagination.',
  example: { limit: '20', q: 'release notes' },
});

export const SearchHitSchema = z
  .strictObject({
    id: UuidSchema.meta({
      description: 'Visible task or list identifier.',
      example: '10000000-0000-4000-8000-000000000100',
      title: 'Result ID',
    }),
    type: z.enum(['list', 'task']).meta({
      description: 'Whether the result opens a list or task details.',
      example: 'task',
      title: 'Result type',
    }),
    title: TitleSchema.meta({
      description: 'Task title or list name, without task content.',
      example: 'Review release notes',
      title: 'Result title',
    }),
    containerId: UuidSchema.nullable().meta({
      description: 'Primary list for a task, or the parent folder for a list.',
      example: '10000000-0000-4000-8000-000000000010',
      title: 'Containing node',
    }),
    path: z
      .array(NameSchema)
      .max(3)
      .meta({
        title: 'Breadcrumb names',
        description: 'Authorized ancestor names; task paths include their primary list.',
        example: ['Engineering', 'Delivery', 'Backlog'],
      }),
  })
  .refine(
    (hit) => hit.type !== 'task' || hit.containerId !== null,
    'Task results require a primary list',
  )
  .meta({
    title: 'Workspace search result',
    description: 'Minimal navigation data for an authorized live task or list.',
    example: {
      id: '10000000-0000-4000-8000-000000000100',
      type: 'task',
      title: 'Review release notes',
      containerId: '10000000-0000-4000-8000-000000000010',
      path: ['Engineering', 'Delivery', 'Backlog'],
    },
  });

export const SearchPositionSchema = z.strictObject({
  id: SearchHitSchema.shape.id,
  type: SearchHitSchema.shape.type,
});

export const SearchPageSchema = cursorPageSchema(SearchHitSchema)
  .extend({
    configVersion: TaskPageSchema.shape.configVersion,
    dataVersion: TaskPageSchema.shape.dataVersion,
  })
  .meta({
    title: 'Workspace search page',
    description: 'Visible search results in stable type and ID order with same-snapshot revisions.',
    example: {
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
      configVersion: 1,
      dataVersion: 1,
    },
  });

export type SearchWorkspaceQuery = z.infer<typeof SearchWorkspaceQuerySchema>;

export type SearchHit = z.infer<typeof SearchHitSchema>;

export type SearchPosition = z.infer<typeof SearchPositionSchema>;

export type SearchPage = z.infer<typeof SearchPageSchema>;
