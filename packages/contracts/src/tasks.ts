import { z } from 'zod';

import { TaskDueDateSchema } from './dates.js';
import { PrioritySchema } from './enums.js';
import { FieldValuesSchema } from './field-values.js';
import {
  FieldKeySchema,
  NameSchema,
  PositionSchema,
  textSchema,
  TitleSchema,
  UuidSchema,
} from './identifiers.js';
import { NodeSchema } from './nodes.js';
import { cursorPageSchema, PaginationQuerySchema } from './pagination.js';
import { ConfigVersionSchema } from './workspaces.js';

const uuid = UuidSchema.overwrite((value) => value.toLowerCase());
const meta = (title: string, description: string, example: unknown) => ({
  title,
  description,
  example,
});

export const TaskAssigneeSchema = z
  .strictObject({
    id: uuid.meta(
      meta(
        'Assignee ID',
        'Workspace member assigned to the task.',
        '10000000-0000-4000-8000-000000000003',
      ),
    ),
    name: NameSchema.meta(
      meta('Assignee name', 'Public display name without email or account details.', 'Alice'),
    ),
  })
  .meta(
    meta('Task assignee', 'Safe assignee display details.', {
      id: '10000000-0000-4000-8000-000000000003',
      name: 'Alice',
    }),
  );

export const TaskSchema = z
  .strictObject({
    id: uuid.meta(meta('Task ID', 'Stable task identity.', '10000000-0000-4000-8000-000000000100')),
    workspaceId: NodeSchema.shape.workspaceId.meta(
      meta('Workspace ID', 'Tenant owning the task.', NodeSchema.shape.workspaceId.meta()?.example),
    ),
    title: TitleSchema.meta(
      meta('Task title', 'Task title, at most 500 characters.', 'Review dashboard'),
    ),
    description: textSchema(50_000).meta(
      meta(
        'Description',
        'Markdown content; clients render without raw HTML.',
        'Review the latest design.',
      ),
    ),
    statusId: uuid.meta(
      meta(
        'Status ID',
        'Canonical status identity available in the primary list.',
        '10000000-0000-4000-8000-000000000101',
      ),
    ),
    priority: PrioritySchema.meta(meta('Priority', 'Urgent, high, normal, low or none.', 'normal')),
    assigneeIds: z
      .array(uuid)
      .max(20)
      .meta(meta('Assignee IDs', 'Assigned member identities in ascending UUID order.', [])),
    assignees: z
      .array(TaskAssigneeSchema)
      .max(20)
      .meta(meta('Assignees', 'Safe assigned member summaries in UUID order.', [])),
    dueDate: TaskDueDateSchema.nullable().meta(
      meta(
        'Due date',
        'ISO datetime with seconds and explicit Z/offset, at most three fractional digits, and UTC years 0001–9999. Normalized to UTC milliseconds; null means unset.',
        null,
      ),
    ),
    customFields: FieldValuesSchema.meta(
      meta('Custom fields', 'Values keyed by the list resolved field schema.', {}),
    ),
    position: PositionSchema.meta(
      meta('Position', 'Server-controlled order within the current status column.', 0),
    ),
    primaryListId: uuid.meta(
      meta('Primary list ID', 'Live list owning the task.', '10000000-0000-4000-8000-000000000010'),
    ),
    parentTaskId: uuid
      .nullable()
      .meta(
        meta(
          'Parent task ID',
          'Top-level parent in the same workspace and list; null for a top-level task. Subtasks cannot have children.',
          null,
        ),
      ),
    version: NodeSchema.shape.version.meta(
      meta('Task version', 'Optimistic task revision advanced by changed commands.', 1),
    ),
    archivedAt: NodeSchema.shape.archivedAt.meta(
      meta('Archived at', 'Archive timestamp or null for a live task.', null),
    ),
    createdAt: NodeSchema.shape.createdAt,
    updatedAt: NodeSchema.shape.updatedAt,
  })
  .meta(
    meta('Task', 'Safe task projection with built-ins, fields and assignees.', {
      id: '10000000-0000-4000-8000-000000000100',
      workspaceId: NodeSchema.shape.workspaceId.meta()?.example,
      title: 'Review dashboard',
      description: 'Review the latest design.',
      statusId: '10000000-0000-4000-8000-000000000101',
      priority: 'normal',
      assigneeIds: [],
      assignees: [],
      dueDate: null,
      customFields: {},
      position: 0,
      primaryListId: '10000000-0000-4000-8000-000000000010',
      parentTaskId: null,
      version: 1,
      archivedAt: null,
      createdAt: '2026-10-24T10:00:00.000Z',
      updatedAt: '2026-10-24T10:00:00.000Z',
    }),
  );

export const TaskSortSchema = z
  .enum(['manual', 'dueDate', 'priority'])
  .meta(meta('Task sort', 'Manual column order, due date or explicit priority rank.', 'manual'));

export const ListTasksQuerySchema = PaginationQuerySchema.extend({
  q: textSchema(200, 1, true)
    .optional()
    .meta(
      meta(
        'Search query',
        'Word or quoted-phrase search over task title and description, up to 200 Unicode characters. Omit to clear.',
        'release notes',
      ),
    ),
  parentTaskId: uuid
    .optional()
    .meta(
      meta(
        'Parent task filter',
        'Return only live children of this visible task in the selected list.',
        '10000000-0000-4000-8000-000000000100',
      ),
    ),
  sort: TaskSortSchema.default('manual'),
  direction: z
    .enum(['asc', 'desc'])
    .default('asc')
    .meta(meta('Direction', 'Sort direction; manual ordering supports ascending only.', 'asc')),
  statusId: uuid
    .optional()
    .meta(
      meta(
        'Status filter',
        'Visible canonical status in this list.',
        '10000000-0000-4000-8000-000000000101',
      ),
    ),
  assigneeId: uuid
    .optional()
    .meta(
      meta(
        'Assignee filter',
        'Current workspace member assigned to the task.',
        '10000000-0000-4000-8000-000000000003',
      ),
    ),
  priority: PrioritySchema.optional().meta(
    meta('Priority filter', 'Match one priority.', 'normal'),
  ),
  fieldKey: FieldKeySchema.optional().meta(
    meta('Field key', 'Resolved field to filter; requires operator and value.', 'effort'),
  ),
  fieldOperator: z
    .enum(['eq', 'contains'])
    .optional()
    .meta(
      meta('Field operator', 'Typed equality, or one-option containment for multi-select.', 'eq'),
    ),
  fieldValue: z
    .string()
    .max(24_002)
    .optional()
    .meta(meta('Field value', 'JSON-encoded scalar validated against the resolved field.', '3')),
})
  .superRefine((query, ctx) => {
    if (query.sort === 'manual' && query.direction !== 'asc')
      ctx.addIssue({
        code: 'custom',
        path: ['direction'],
        message: 'Manual sort supports ascending only',
      });

    const supplied = [query.fieldKey, query.fieldOperator, query.fieldValue].filter(
      (value) => value !== undefined,
    ).length;
    if (supplied !== 0 && supplied !== 3)
      ctx.addIssue({
        code: 'custom',
        path: ['fieldKey'],
        message: 'Field key, operator and value must be supplied together',
      });
  })
  .meta(
    meta('Task query', 'Cursor page with server-side sorting and typed filters.', {
      direction: 'asc',
      limit: '50',
      sort: 'manual',
    }),
  );

export const TaskParamsSchema = z.strictObject({ taskId: TaskSchema.shape.id }).meta(
  meta('Task parameters', 'Task identifier in the active tenant.', {
    taskId: TaskSchema.shape.id.meta()?.example,
  }),
);

export const TaskListParamsSchema = z.strictObject({ listId: TaskSchema.shape.primaryListId }).meta(
  meta('Task list parameters', 'Live list identifier.', {
    listId: TaskSchema.shape.primaryListId.meta()?.example,
  }),
);

export const TaskPageSchema = cursorPageSchema(TaskSchema)
  .extend({
    configVersion: ConfigVersionSchema,
    dataVersion: ConfigVersionSchema.meta(
      meta('Data version', 'Workspace task and tree data revision.', 1),
    ),
  })
  .meta(
    meta('Task page', 'Authorized tasks and same-snapshot revisions.', {
      items: [],
      pageInfo: { hasNextPage: false, nextCursor: null },
      configVersion: 1,
      dataVersion: 1,
    }),
  );

export const TaskEnvelopeSchema = z
  .strictObject({
    data: TaskSchema,
    configVersion: TaskPageSchema.shape.configVersion,
    dataVersion: TaskPageSchema.shape.dataVersion,
  })
  .meta(
    meta('Task response', 'One authorized task and same-snapshot revisions.', {
      data: TaskSchema.meta()?.example,
      configVersion: 1,
      dataVersion: 1,
    }),
  );

export const TaskPositionSchema = z.discriminatedUnion('sort', [
  z.strictObject({ sort: z.literal('manual'), id: uuid, statusId: uuid, position: PositionSchema }),
  z.strictObject({ sort: z.literal('dueDate'), id: uuid, dueDate: TaskDueDateSchema.nullable() }),
  z.strictObject({ sort: z.literal('priority'), id: uuid, priority: PrioritySchema }),
]);

export type Task = z.infer<typeof TaskSchema>;

export type ListTasksQuery = z.infer<typeof ListTasksQuerySchema>;

export type TaskPosition = z.infer<typeof TaskPositionSchema>;
