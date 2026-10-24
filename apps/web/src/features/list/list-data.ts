import {
  CursorSchema,
  PrioritySchema,
  ResolvedFieldCollectionSchema,
  TaskPageSchema,
  validateTaskFields,
} from '@flowboard/contracts';

import { readBoardStatuses } from '../board/board-data.ts';

import { readListFilter } from './list-filter.ts';

import type { TaskTableQuery } from './list-location';
import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';

export type TaskListResult =
  | { state: 'pending' | 'stale' | 'invalid' }
  | {
      configVersion: number;
      dataVersion: number;
      fields: readonly ResolvedField[];
      items: readonly Task[];
      nextCursor: string | null;
      state: 'ready';
      statuses: readonly ResolvedStatus[];
    };

const lexical = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

export function readListFields(value: unknown, workspaceId: string, listId: string) {
  if (value === undefined) return { state: 'pending' as const };

  const parsed = ResolvedFieldCollectionSchema.safeParse(value);
  if (!parsed.success) return { state: 'invalid' as const };

  const { items, configVersion } = parsed.data;
  if (
    new Set(items.map((field) => field.id)).size !== items.length ||
    new Set(items.map((field) => field.key)).size !== items.length ||
    items.some((field, index) => {
      const previous = items[index - 1];

      return (
        field.workspaceId !== workspaceId ||
        (field.ownerType === 'list' && field.ownerId !== listId) ||
        field.isInherited !== (field.ownerType !== 'list') ||
        field.source.fieldId !== field.id ||
        field.source.ownerId !== field.ownerId ||
        field.source.ownerType !== field.ownerType ||
        field.source.createdAt !== field.createdAt ||
        field.source.updatedAt !== field.updatedAt ||
        (previous &&
          (previous.position - field.position ||
            lexical(previous.key, field.key) ||
            lexical(previous.id, field.id)) > 0)
      );
    })
  )
    return { state: 'invalid' as const };

  return { state: 'ready' as const, items, configVersion };
}

function compareDue(left: Task, right: Task, direction: TaskTableQuery['direction']) {
  if (left.dueDate === null && right.dueDate !== null) return 1;

  if (left.dueDate !== null && right.dueDate === null) return -1;

  const order = lexical(left.dueDate ?? '', right.dueDate ?? '');

  return (direction === 'asc' ? order : -order) || lexical(left.id, right.id);
}

function compareTasks(
  left: Task,
  right: Task,
  query: TaskTableQuery,
  statuses: readonly ResolvedStatus[],
) {
  if (query.sort === 'dueDate') return compareDue(left, right, query.direction);

  if (query.sort === 'priority') {
    const order =
      PrioritySchema.options.indexOf(left.priority) -
      PrioritySchema.options.indexOf(right.priority);

    return (query.direction === 'asc' ? order : -order) || lexical(left.id, right.id);
  }

  return (
    statuses.findIndex((status) => status.id === left.statusId) -
      statuses.findIndex((status) => status.id === right.statusId) ||
    left.position - right.position ||
    lexical(left.id, right.id)
  );
}

function matchesFilter(
  task: Task,
  query: TaskTableQuery,
  fields: readonly ResolvedField[],
  value: string | number | boolean | undefined,
) {
  if (query.fieldKey === undefined) return true;

  const field = fields.find((item) => item.key === query.fieldKey);
  const actual = task.customFields[query.fieldKey];
  const normalize = (item: unknown) =>
    typeof item === 'string' && (field?.type === 'single_select' || field?.type === 'multi_select')
      ? item.toLowerCase()
      : item;

  return query.fieldOperator === 'contains'
    ? Array.isArray(actual) && actual.some((item) => normalize(item) === normalize(value))
    : normalize(actual) === normalize(value);
}

export function assembleTaskList(input: {
  fields: unknown;
  listId: string;
  pages: readonly { cursor?: string; response: unknown }[];
  query: TaskTableQuery;
  statuses: unknown;
  workspaceId: string;
}): TaskListResult {
  const statuses = readBoardStatuses(input.statuses, input.workspaceId);
  if (statuses.state !== 'ready') return statuses;

  const fields = readListFields(input.fields, input.workspaceId, input.listId);
  if (fields.state !== 'ready') return fields;

  if (fields.configVersion !== statuses.configVersion) return { state: 'stale' };

  const filter = readListFilter(input.query, fields.items);
  if (!filter.ok) return { state: 'invalid' };

  const statusIds = new Set(statuses.items.map((status) => status.id));
  const items: Task[] = [];
  const ids = new Set<string>();
  const cursors = new Set<string>();
  let expected: string | null | undefined;
  let dataVersion: number | undefined;
  for (const [index, entry] of input.pages.entries()) {
    if (
      (index > 0 && expected === null) ||
      entry.cursor !== expected ||
      (entry.cursor !== undefined && !CursorSchema.safeParse(entry.cursor).success)
    )
      return { state: 'invalid' };

    const page = TaskPageSchema.safeParse(entry.response);
    if (!page.success) return { state: 'invalid' };

    if (
      page.data.configVersion !== statuses.configVersion ||
      (dataVersion !== undefined && page.data.dataVersion !== dataVersion)
    )
      return { state: 'stale' };

    dataVersion = page.data.dataVersion;
    for (const task of page.data.items) {
      const previous = items.at(-1);
      if (
        task.workspaceId !== input.workspaceId ||
        task.primaryListId !== input.listId ||
        task.archivedAt !== null ||
        !statusIds.has(task.statusId) ||
        ids.has(task.id) ||
        validateTaskFields({ fields: fields.items, values: task.customFields }).length > 0 ||
        !matchesFilter(task, input.query, fields.items, filter.value) ||
        (previous && compareTasks(previous, task, input.query, statuses.items) > 0)
      )
        return { state: 'invalid' };

      ids.add(task.id);
      items.push(task);
    }
    expected = page.data.pageInfo.nextCursor;
    if (expected !== null) {
      if (cursors.has(expected)) return { state: 'invalid' };

      cursors.add(expected);
    }
  }
  if (dataVersion === undefined) return { state: 'pending' };

  return {
    state: 'ready',
    fields: fields.items,
    statuses: statuses.items,
    items,
    configVersion: statuses.configVersion,
    dataVersion,
    nextCursor: expected ?? null,
  };
}
