import {
  applyTaskFieldPatch,
  ArchiveTaskSchema,
  CreateTaskSchema,
  ListTasksQuerySchema,
  MoveTaskSchema,
  PrioritySchema,
  ReorderTaskSchema,
  selectTaskStatus,
  TaskPositionSchema,
  UpdateTaskSchema,
  UuidSchema,
  validateTaskFields,
} from '@flowboard/contracts';

import { Prisma } from './generated/client.js';
import { recordTaskChange, recordTaskChanges } from './task-events.js';
import { DatabaseError } from './tenant-context.js';

import type { accessRepository } from './access-repository.js';
import type { fieldRepository } from './field-repository.js';
import type { scopeRepository } from './scope-repository.js';
import type { statusRepository } from './status-repository.js';
import type { TenantContext } from './tenant-context.js';
import type {
  ArchiveTask,
  CreateTask,
  ListTasksQuery,
  MoveTask,
  ReorderTask,
  Task,
  TaskPosition,
  TaskUpdatedEvent,
  UpdateTask,
} from '@flowboard/contracts';

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
  parentTaskId: true,
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
    dueDate: row.dueDate?.toISOString() ?? null,
    customFields: row.customFields as Task['customFields'],
    position: row.position,
    primaryListId: row.primaryListId,
    parentTaskId: row.parentTaskId,
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
  access: ReturnType<typeof accessRepository>['read'],
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

  const read = Object.freeze({
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
      if (query.parentTaskId && (await find(query.parentTaskId)).primaryListId !== listId)
        throw new DatabaseError('INVALID_PARENT', 'Parent must belong to the selected list', [
          {
            code: 'invalid_parent',
            path: ['parentTaskId'],
            message: 'Choose a parent in this list',
          },
        ]);

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
              : Prisma.sql`AND (t.due_date IS NULL OR t.due_date ${comparison} ${cursor.dueDate}::timestamptz OR (t.due_date=${cursor.dueDate}::timestamptz AND t.id>${cursor.id}::uuid))`;
        } else {
          const index = PrioritySchema.options.indexOf(cursor.priority) + 1;
          continuation = Prisma.sql`AND (${priorityRank} ${comparison} ${index} OR (${priorityRank}=${index} AND t.id>${cursor.id}::uuid))`;
        }
      }

      const ids = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT t.id FROM tasks t WHERE t.workspace_id=${workspaceId}::uuid AND t.primary_list_id=${listId}::uuid AND t.archived_at IS NULL
        ${query.statusId ? Prisma.sql`AND t.status_id=${query.statusId}::uuid` : Prisma.empty}
        ${query.parentTaskId ? Prisma.sql`AND t.parent_task_id=${query.parentTaskId}::uuid` : Prisma.empty}
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
  async function preconditions(
    expectedConfigVersion: number,
    task?: Task,
    expectedVersion?: number,
  ) {
    const current = await revisions();
    if (current.configVersion !== expectedConfigVersion)
      throw new DatabaseError('CONFIG_CONFLICT', 'Workspace configuration changed');

    if (task && task.version !== expectedVersion)
      throw new DatabaseError('VERSION_CONFLICT', 'Task changed');

    return current;
  }
  async function position(listId: string, statusId: string) {
    const value = await tx.task.aggregate({
      where: { workspaceId, primaryListId: listId, statusId, archivedAt: null },
      _max: { position: true },
    });
    const next = (value._max.position ?? -1) + 1;
    if (next > 2147483647)
      throw new DatabaseError('VALIDATION_FAILED', 'Column position limit exceeded');

    return next;
  }
  async function validate(
    listId: string,
    proposed: { assigneeIds: string[]; customFields: unknown; statusId: string },
  ) {
    const resolved = await statuses.resolved(listId);
    if (!resolved.items.some((status) => status.id === proposed.statusId))
      throw new DatabaseError('STATUS_NOT_AVAILABLE', 'Status is not available in this list', [
        {
          code: 'unavailable_status',
          path: ['statusId'],
          message: 'Choose a resolved list status',
        },
      ]);

    const members = await tx.membership.findMany({
      where: { workspaceId, userId: { in: proposed.assigneeIds } },
      select: { userId: true },
    });
    if (members.length !== proposed.assigneeIds.length)
      throw new DatabaseError('NOT_FOUND', 'Assignee not found');

    const allowed = new Set(await access.assignableMemberIds(listId));
    const forbidden = proposed.assigneeIds.findIndex((id) => !allowed.has(id));
    if (forbidden >= 0)
      throw new DatabaseError('FORBIDDEN', 'Assignee cannot access this list', [
        {
          code: 'forbidden_assignee',
          path: ['assigneeIds', forbidden],
          message: 'Choose a member who can see this list',
        },
      ]);

    const schema = await fields.resolved(listId);
    const issues = validateTaskFields({ fields: schema.items, values: proposed.customFields });
    if (issues.length)
      throw new DatabaseError('FIELD_VALUE_INVALID', 'Task field values are invalid', issues);
  }
  async function validateParent(listId: string, parentTaskId: string | null, taskId?: string) {
    if (parentTaskId === null) return;

    const parent = await find(parentTaskId);
    const hasChildren = taskId
      ? await tx.task.findFirst({
          where: { workspaceId, parentTaskId: taskId },
          select: { id: true },
        })
      : null;
    if (
      parent.id === taskId ||
      parent.primaryListId !== listId ||
      parent.parentTaskId !== null ||
      hasChildren
    )
      throw new DatabaseError('INVALID_PARENT', 'Choose a top-level parent in the same list', [
        {
          code: 'invalid_parent',
          path: ['parentTaskId'],
          message:
            'Subtasks must have a distinct top-level parent in the same list and cannot have children',
        },
      ]);
  }
  async function place(taskId: string, input: MoveTask | ReorderTask) {
    const moving = 'destinationListId' in input;
    const command: ReorderTask &
      Partial<Pick<MoveTask, 'destinationListId' | 'statusId' | 'customFields'>> = moving
      ? MoveTaskSchema.parse(input)
      : ReorderTaskSchema.parse(input);
    const previous = await find(taskId);
    const current = await preconditions(
      command.expectedConfigVersion,
      previous,
      command.expectedVersion,
    );
    const destinationListId = command.destinationListId ?? previous.primaryListId;
    await scopes.path({ ownerType: 'list', ownerId: destinationListId });
    if (
      destinationListId !== previous.primaryListId &&
      (previous.parentTaskId !== null ||
        (await tx.task.findFirst({
          where: { workspaceId, parentTaskId: previous.id },
          select: { id: true },
        })))
    )
      throw new DatabaseError(
        'TASK_RELATION_IN_USE',
        'Detach live subtasks before moving; archived child references also prevent moving their parent',
      );

    const sourceStatuses = await statuses.resolved(previous.primaryListId);
    const sourceStatus = sourceStatuses.items.find((status) => status.id === previous.statusId);
    if (!sourceStatus)
      throw new DatabaseError('STATUS_NOT_AVAILABLE', 'Source status is unavailable');

    const destinationStatuses = await statuses.resolved(destinationListId);
    const selected = selectTaskStatus(
      sourceStatus,
      destinationStatuses.items,
      moving ? command.statusId : previous.statusId,
    );
    if (!selected.success)
      throw new DatabaseError('STATUS_NOT_AVAILABLE', 'No matching destination status', [
        {
          code: 'unavailable_status',
          path: ['statusId'],
          message: 'Choose an available destination status',
        },
      ]);

    const statusId = selected.statusId;
    const schema = await fields.resolved(destinationListId);
    const values = applyTaskFieldPatch({
      fields: schema.items,
      current: previous.customFields,
      patch: command.customFields ?? {},
    });
    if (!values.success)
      throw new DatabaseError(
        'FIELD_VALUE_INVALID',
        'Task field values are invalid',
        values.issues,
      );

    await validate(destinationListId, {
      statusId,
      assigneeIds: previous.assigneeIds,
      customFields: values.values,
    });
    const { placement } = command;
    const anchorId =
      'beforeId' in placement
        ? placement.beforeId
        : 'afterId' in placement
          ? placement.afterId
          : undefined;
    if (anchorId) {
      const anchor = await find(anchorId);
      if (
        anchor.id === previous.id ||
        anchor.primaryListId !== destinationListId ||
        anchor.statusId !== statusId
      )
        throw new DatabaseError(
          'INVALID_ANCHOR',
          'Anchor must be a distinct task in the destination column',
        );
    }

    const column = (listId: string, columnStatusId: string) =>
      tx.task.findMany({
        where: { workspaceId, primaryListId: listId, statusId: columnStatusId, archivedAt: null },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });
    const sourceRows = await column(previous.primaryListId, previous.statusId);
    const sameColumn =
      destinationListId === previous.primaryListId && statusId === previous.statusId;
    const destinationRows = sameColumn ? sourceRows : await column(destinationListId, statusId);
    const remaining = destinationRows.filter((row) => row.id !== previous.id);
    const index =
      'edge' in placement
        ? placement.edge === 'start'
          ? 0
          : remaining.length
        : remaining.findIndex((row) => row.id === anchorId) + ('afterId' in placement ? 1 : 0);
    const destinationOrder = [...remaining.slice(0, index), previous, ...remaining.slice(index)];
    const originals = new Map([...sourceRows, ...destinationRows].map((row) => [row.id, row]));
    const positions = new Map<string, number>();
    if (!sameColumn)
      sourceRows
        .filter((row) => row.id !== previous.id)
        .forEach((row, position) => positions.set(row.id, position));

    destinationOrder.forEach((row, position) => positions.set(row.id, position));
    const events: Parameters<typeof recordTaskChanges>[2][number][] = [];
    for (const [id, position] of positions) {
      const before = originals.get(id)!;
      const target = id === previous.id;
      const changes: TaskUpdatedEvent['changes'] = {};
      if (before.position !== position)
        changes.position = { before: before.position, after: position };

      if (target) {
        if (before.primaryListId !== destinationListId)
          changes.primaryListId = { before: before.primaryListId, after: destinationListId };

        if (before.statusId !== statusId)
          changes.statusId = { before: before.statusId, after: statusId };

        const keys = [
          ...new Set([...Object.keys(previous.customFields), ...Object.keys(values.values)]),
        ]
          .filter(
            (key) =>
              JSON.stringify(previous.customFields[key]) !== JSON.stringify(values.values[key]),
          )
          .sort();
        if (keys.length) changes.customFieldKeys = keys;
      }

      if (Object.keys(changes).length === 0) continue;

      const updated = await tx.task.update({
        where: { workspaceId_id: { workspaceId, id } },
        data: {
          position,
          version: { increment: 1 },
          ...(target
            ? { primaryListId: destinationListId, statusId, customFields: values.values }
            : {}),
        },
      });
      events.push({ task: updated, changes, previousListId: before.primaryListId });
    }
    const revisions = events.length ? await recordTaskChanges(tx, context, events) : current;

    return {
      data: await find(previous.id),
      ...revisions,
      changedTaskIds: events.map((event) => event.task.id),
    };
  }

  const write = Object.freeze({
    move: (taskId: string, input: MoveTask) => place(taskId, MoveTaskSchema.parse(input)),
    reorder: (taskId: string, input: ReorderTask) => place(taskId, ReorderTaskSchema.parse(input)),
    ...read,
    async create(listId: string, input: CreateTask) {
      await scopes.path({ ownerType: 'list', ownerId: listId });
      const { expectedConfigVersion, ...data } = CreateTaskSchema.parse(input);
      await preconditions(expectedConfigVersion);
      await validateParent(listId, data.parentTaskId);
      const schema = await fields.resolved(listId);
      const values = applyTaskFieldPatch({
        fields: schema.items,
        current: {},
        patch: data.customFields,
      });
      if (!values.success)
        throw new DatabaseError(
          'FIELD_VALUE_INVALID',
          'Task field values are invalid',
          values.issues,
        );

      await validate(listId, { ...data, customFields: values.values });
      const assigneeIds = [...data.assigneeIds].sort();
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp()::timestamptz(3) AS now`;
      if (!clock) throw new Error('Database clock unavailable');

      const row = await tx.task.create({
        data: {
          workspaceId,
          primaryListId: listId,
          parentTaskId: data.parentTaskId,
          title: data.title,
          description: data.description,
          statusId: data.statusId,
          priority: data.priority,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          customFields: values.values,
          position: await position(listId, data.statusId),
          createdAt: clock.now,
        },
      });
      if (assigneeIds.length)
        await tx.taskAssignee.createMany({
          data: assigneeIds.map((userId) => ({
            workspaceId,
            taskId: row.id,
            userId,
            createdAt: row.updatedAt,
          })),
        });

      const versions = await recordTaskChange(tx, context, row);

      return { data: await find(row.id), ...versions, changedTaskIds: [row.id] };
    },
    async update(taskId: string, input: UpdateTask) {
      const previous = await find(taskId);
      const parsed = UpdateTaskSchema.parse(input);
      const current = await preconditions(
        parsed.expectedConfigVersion,
        previous,
        parsed.expectedVersion,
      );
      const schema = await fields.resolved(previous.primaryListId);
      const values = applyTaskFieldPatch({
        fields: schema.items,
        current: previous.customFields,
        patch: parsed.customFields ?? {},
      });
      if (!values.success)
        throw new DatabaseError(
          'FIELD_VALUE_INVALID',
          'Task field values are invalid',
          values.issues,
        );

      const next = {
        ...previous,
        title: parsed.title ?? previous.title,
        description: parsed.description ?? previous.description,
        statusId: parsed.statusId ?? previous.statusId,
        priority: parsed.priority ?? previous.priority,
        dueDate: parsed.dueDate === undefined ? previous.dueDate : parsed.dueDate,
        parentTaskId:
          parsed.parentTaskId === undefined ? previous.parentTaskId : parsed.parentTaskId,
        customFields: values.values,
        assigneeIds: [...(parsed.assigneeIds ?? previous.assigneeIds)].sort(),
      };
      await validateParent(previous.primaryListId, next.parentTaskId, previous.id);
      await validate(previous.primaryListId, {
        ...next,
        assigneeIds: parsed.assigneeIds ?? previous.assigneeIds,
      });
      const changes: TaskUpdatedEvent['changes'] = {};
      if (next.title !== previous.title) changes.title = true;

      if (next.description !== previous.description) changes.description = true;

      if (next.statusId !== previous.statusId)
        changes.statusId = { before: previous.statusId, after: next.statusId };

      if (next.priority !== previous.priority)
        changes.priority = { before: previous.priority, after: next.priority };

      if (next.dueDate !== previous.dueDate)
        changes.dueDate = { before: previous.dueDate, after: next.dueDate };

      if (next.parentTaskId !== previous.parentTaskId)
        changes.parentTaskId = { before: previous.parentTaskId, after: next.parentTaskId };

      if (JSON.stringify(next.assigneeIds) !== JSON.stringify(previous.assigneeIds))
        changes.assigneeIds = { before: previous.assigneeIds, after: next.assigneeIds };

      const changedKeys = [
        ...new Set([...Object.keys(previous.customFields), ...Object.keys(next.customFields)]),
      ]
        .filter(
          (key) =>
            JSON.stringify(previous.customFields[key]) !== JSON.stringify(next.customFields[key]),
        )
        .sort();
      if (changedKeys.length) changes.customFieldKeys = changedKeys;

      if (Object.keys(changes).length === 0)
        return { data: previous, ...current, changedTaskIds: [] };

      const nextPosition = changes.statusId
        ? await position(previous.primaryListId, next.statusId)
        : previous.position;
      if (nextPosition !== previous.position)
        changes.position = { before: previous.position, after: nextPosition };

      const row = await tx.task.update({
        where: { workspaceId_id: { workspaceId, id: taskId } },
        data: {
          title: next.title,
          description: next.description,
          statusId: next.statusId,
          priority: next.priority,
          dueDate: next.dueDate ? new Date(next.dueDate) : null,
          parentTaskId: next.parentTaskId,
          customFields: next.customFields,
          position: nextPosition,
          version: { increment: 1 },
        },
      });
      if (changes.assigneeIds) {
        const removed = previous.assigneeIds.filter((id) => !next.assigneeIds.includes(id));
        const added = next.assigneeIds.filter((id) => !previous.assigneeIds.includes(id));
        if (removed.length)
          await tx.taskAssignee.deleteMany({
            where: { workspaceId, taskId, userId: { in: removed } },
          });

        if (added.length)
          await tx.taskAssignee.createMany({
            data: added.map((userId) => ({
              workspaceId,
              taskId,
              userId,
              createdAt: row.updatedAt,
            })),
          });
      }

      const versions = await recordTaskChange(tx, context, row, changes);

      return { data: await find(taskId), ...versions, changedTaskIds: [taskId] };
    },
    async archive(taskId: string, input: ArchiveTask) {
      const previous = await find(taskId);
      const parsed = ArchiveTaskSchema.parse(input);
      await preconditions(parsed.expectedConfigVersion, previous, parsed.expectedVersion);
      if (
        await tx.task.findFirst({
          where: { workspaceId, parentTaskId: previous.id, archivedAt: null },
          select: { id: true },
        })
      )
        throw new DatabaseError(
          'TASK_RELATION_IN_USE',
          'Archive or detach live subtasks before archiving their parent',
        );

      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp()::timestamptz(3) AS now`;
      if (!clock) throw new Error('Database clock unavailable');

      const row = await tx.task.update({
        where: { workspaceId_id: { workspaceId, id: taskId } },
        data: { archivedAt: clock.now, version: { increment: 1 } },
      });
      await recordTaskChange(tx, context, row, {
        archivedAt: { before: null, after: clock.now.toISOString() },
      });
    },
  });

  return { read, write };
}
