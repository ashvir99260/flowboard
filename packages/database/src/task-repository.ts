import {
  ListTasksQuerySchema,
  PrioritySchema,
  TaskPositionSchema,
  UuidSchema,
  validateTaskFields,
} from '@flowboard/contracts';

import { Prisma } from './generated/client.js';
import { DatabaseError } from './tenant-context.js';

import type { fieldRepository } from './field-repository.js';
import type { scopeRepository } from './scope-repository.js';
import type { statusRepository } from './status-repository.js';
import type { TenantContext } from './tenant-context.js';
import type { ListTasksQuery, Task, TaskPosition } from '@flowboard/contracts';

const taskSelect = {
  id: true,
  workspaceId: true,
  title: true,
  description: true,
  statusId: true,
  priority: true,
  dueDate: true,
  customFields: true,
  position: true,
  primaryListId: true,
  version: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  assignees: {
    orderBy: { userId: 'asc' },
    select: {
      userId: true,
      membership: { select: { user: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;
function present(row: TaskRow): Task {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    statusId: row.statusId,
    priority: row.priority,
    dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    customFields: row.customFields as Task['customFields'],
    position: row.position,
    primaryListId: row.primaryListId,
    version: row.version,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    assigneeIds: row.assignees.map((assignment) => assignment.userId),
    assignees: row.assignees.map((assignment) => assignment.membership.user),
  };
}
export function taskRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  scopes: ReturnType<typeof scopeRepository>,
  assertActive: () => void,
  statuses: ReturnType<typeof statusRepository>['read'],
  fields: ReturnType<typeof fieldRepository>['read'],
) {
  const { workspaceId } = context;
  async function revisions() {
    assertActive();

    return tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { configVersion: true, dataVersion: true },
    });
  }
  async function find(id: string) {
    assertActive();
    const row = await tx.task.findFirst({
      where: { workspaceId, id: UuidSchema.parse(id).toLowerCase(), archivedAt: null },
      select: taskSelect,
    });
    if (!row) throw new DatabaseError('NOT_FOUND', 'Task not found');

    await scopes.path({ ownerType: 'list', ownerId: row.primaryListId });

    return present(row);
  }
  async function filter(listId: string, query: ListTasksQuery) {
    if (query.fieldKey === undefined) return Prisma.empty;

    const resolved = await fields.resolved(listId);
    const field = resolved.items.find((item) => item.key === query.fieldKey);
    const invalid = (path: string, message: string) =>
      new DatabaseError('FIELD_VALUE_INVALID', 'Invalid field filter', [
        { code: 'invalid_filter', path: [path], message },
      ]);
    if (!field) throw invalid('fieldKey', 'Field is not available in this list');

    if ((query.fieldOperator === 'contains') !== (field.type === 'multi_select'))
      throw invalid('fieldOperator', 'Operator does not match the field type');

    let value: unknown;
    try {
      value = JSON.parse(query.fieldValue!);
    } catch {
      throw invalid('fieldValue', 'Expected a JSON-encoded scalar');
    }
    if (value === null || !['string', 'number', 'boolean'].includes(typeof value))
      throw invalid('fieldValue', 'Expected a non-null scalar value');

    const issues = validateTaskFields({
      fields: [{ ...field, required: false }],
      values: { [field.key]: query.fieldOperator === 'contains' ? [value] : value },
    });
    if (issues.length > 0) throw invalid('fieldValue', 'Value does not match the resolved field');

    const normalized =
      field.type === 'single_select' || field.type === 'multi_select'
        ? String(value).toLowerCase()
        : value;

    return query.fieldOperator === 'contains'
      ? Prisma.sql`AND t.custom_fields -> ${field.key} @> ${JSON.stringify([normalized])}::jsonb`
      : Prisma.sql`AND t.custom_fields -> ${field.key} = ${JSON.stringify(normalized)}::jsonb`;
  }

  return Object.freeze({
    find,
    revisions,
    async list(listId: string, input: ListTasksQuery, after?: TaskPosition) {
      const parsed = ListTasksQuerySchema.safeParse({ ...input, limit: String(input.limit) });
      if (!parsed.success)
        throw new DatabaseError(
          'VALIDATION_FAILED',
          'Invalid task query',
          parsed.error.issues.map((issue) => ({
            code: issue.code,
            message: 'Task query does not match its schema',
            path: issue.path.map((part) => (typeof part === 'symbol' ? String(part) : part)),
          })),
        );

      const query = parsed.data;
      await scopes.path({ ownerType: 'list', ownerId: listId });
      const resolved = await statuses.resolved(listId);
      const statusIds = resolved.items.map((item) => item.id);
      if (query.statusId && !statusIds.includes(query.statusId))
        throw new DatabaseError('STATUS_NOT_AVAILABLE', 'Status is not available in this list', [
          {
            code: 'unavailable_status',
            path: ['statusId'],
            message: 'Choose a resolved list status',
          },
        ]);

      if (
        query.assigneeId &&
        !(await tx.membership.findFirst({ where: { workspaceId, userId: query.assigneeId } }))
      )
        throw new DatabaseError('NOT_FOUND', 'Member not found');

      const rank = Prisma.sql`array_position(ARRAY[${Prisma.join(statusIds.map((id) => Prisma.sql`${id}::uuid`))}],t.status_id)`;
      const priorityRank = Prisma.sql`array_position(ARRAY[${Prisma.join(PrioritySchema.options)}]::text[],t.priority::text)`;
      const descending = query.direction === 'desc';
      const direction = descending ? Prisma.sql`DESC` : Prisma.sql`ASC`;
      const comparison = descending ? Prisma.sql`<` : Prisma.sql`>`;
      const orders = {
        manual: Prisma.sql`${rank} ASC,t.position ASC,t.id ASC`,
        dueDate: Prisma.sql`t.due_date ${direction} NULLS LAST,t.id ASC`,
        priority: Prisma.sql`${priorityRank} ${direction},t.id ASC`,
      };
      let continuation = Prisma.empty;
      if (after) {
        const cursor = TaskPositionSchema.parse(after);
        if (cursor.sort !== query.sort)
          throw new DatabaseError('INVALID_CURSOR', 'Cursor sort does not match');

        if (cursor.sort === 'manual') {
          const index = statusIds.indexOf(cursor.statusId);
          if (index < 0) throw new DatabaseError('INVALID_CURSOR', 'Cursor status is unavailable');

          continuation = Prisma.sql`AND (${rank},t.position,t.id)>(${index + 1},${cursor.position},${cursor.id}::uuid)`;
        } else if (cursor.sort === 'dueDate') {
          continuation =
            cursor.dueDate === null
              ? Prisma.sql`AND t.due_date IS NULL AND t.id>${cursor.id}::uuid`
              : Prisma.sql`AND (t.due_date IS NULL OR t.due_date ${comparison} ${cursor.dueDate}::date OR (t.due_date=${cursor.dueDate}::date AND t.id>${cursor.id}::uuid))`;
        } else {
          const index = PrioritySchema.options.indexOf(cursor.priority) + 1;
          continuation = Prisma.sql`AND (${priorityRank} ${comparison} ${index} OR (${priorityRank}=${index} AND t.id>${cursor.id}::uuid))`;
        }
      }

      const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT t.id FROM tasks t WHERE t.workspace_id=${workspaceId}::uuid AND t.primary_list_id=${listId}::uuid AND t.archived_at IS NULL
        ${query.statusId ? Prisma.sql`AND t.status_id=${query.statusId}::uuid` : Prisma.empty}
        ${query.priority ? Prisma.sql`AND t.priority::text=${query.priority}` : Prisma.empty}
        ${query.assigneeId ? Prisma.sql`AND EXISTS (SELECT 1 FROM task_assignees a WHERE a.workspace_id=t.workspace_id AND a.task_id=t.id AND a.user_id=${query.assigneeId}::uuid)` : Prisma.empty}
        ${await filter(listId, query)} ${continuation} ORDER BY ${orders[query.sort]} LIMIT ${query.limit + 1}`);
      const rows = await tx.task.findMany({
        where: { workspaceId, id: { in: ids.map((row) => row.id) } },
        select: taskSelect,
      });
      const byId = new Map(rows.map((row) => [row.id, present(row)]));

      return ids.map((row) => byId.get(row.id)!);
    },
  });
}
