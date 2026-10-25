import {
  CursorSchema,
  ResolvedFieldCollectionSchema,
  ResolvedStatusCollectionSchema,
  TaskPageSchema,
  UuidSchema,
  validateTaskFields,
} from '@flowboard/contracts';

import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';

export interface BoardPageRequest {
  readonly cursor?: string;
  readonly statusId: string;
}

export interface BoardColumn {
  readonly nextCursor: string | null;
  readonly status: ResolvedStatus;
  readonly tasks: readonly Task[];
}

export type BoardResult =
  | { state: 'pending' | 'stale' | 'invalid' }
  | {
      columns: readonly BoardColumn[];
      configVersion: number;
      dataVersion: number;
      fields: readonly ResolvedField[];
      state: 'ready';
    };

const lexical = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);
const schemaOrder = (left: ResolvedField | ResolvedStatus, right: ResolvedField | ResolvedStatus) =>
  left.position - right.position || lexical(left.key, right.key) || lexical(left.id, right.id);
const taskOrder = (left: Task, right: Task) =>
  left.position - right.position || lexical(left.id, right.id);
const ordered = <T>(items: readonly T[], compare: (left: T, right: T) => number) =>
  items.every((item, index) => index === 0 || compare(items[index - 1]!, item) <= 0);
const unique = (items: readonly { id: string; key: string }[]) =>
  new Set(items.map((item) => item.id)).size === items.length &&
  new Set(items.map((item) => item.key)).size === items.length;
const requiredCategories = ['not_started', 'active', 'done'];
const key = ({ statusId, cursor }: BoardPageRequest) => `${statusId}:${cursor ?? ''}`;

export function readBoardStatuses(
  value: unknown,
  workspaceId: string,
):
  | { state: 'pending' | 'invalid' }
  | { configVersion: number; items: ResolvedStatus[]; state: 'ready' } {
  if (value === undefined) return { state: 'pending' };

  const parsed = ResolvedStatusCollectionSchema.safeParse(value);
  if (!parsed.success) return { state: 'invalid' };

  const { items, configVersion } = parsed.data;
  if (
    !items.length ||
    !unique(items) ||
    !ordered(items, schemaOrder) ||
    items.some((item) => item.workspaceId !== workspaceId) ||
    requiredCategories.some((category) => !items.some((item) => item.category === category))
  )
    return { state: 'invalid' };

  return { state: 'ready', items, configVersion };
}

export function assembleBoard(input: {
  readonly fields: unknown;
  readonly listId: string;
  readonly pages: readonly { readonly request: BoardPageRequest; readonly response: unknown }[];
  readonly statuses: unknown;
  readonly workspaceId: string;
}): BoardResult {
  const statuses = readBoardStatuses(input.statuses, input.workspaceId);
  if (statuses.state !== 'ready') return statuses;

  if (input.fields === undefined) return { state: 'pending' };

  const fields = ResolvedFieldCollectionSchema.safeParse(input.fields);
  if (
    !fields.success ||
    !unique(fields.data.items) ||
    !ordered(fields.data.items, schemaOrder) ||
    fields.data.items.some((field) => field.workspaceId !== input.workspaceId)
  )
    return { state: 'invalid' };

  if (fields.data.configVersion !== statuses.configVersion) return { state: 'stale' };

  const statusIds = new Set(statuses.items.map((status) => status.id));
  const pages = new Map<string, ReturnType<typeof TaskPageSchema.parse>>();
  let dataVersion: number | undefined;
  for (const entry of input.pages) {
    const parsed = TaskPageSchema.safeParse(entry.response);
    if (
      !parsed.success ||
      !UuidSchema.safeParse(entry.request.statusId).success ||
      (entry.request.cursor !== undefined &&
        !CursorSchema.safeParse(entry.request.cursor).success) ||
      !statusIds.has(entry.request.statusId) ||
      pages.has(key(entry.request))
    )
      return { state: 'invalid' };

    if (
      parsed.data.configVersion !== statuses.configVersion ||
      (dataVersion !== undefined && dataVersion !== parsed.data.dataVersion)
    )
      return { state: 'stale' };

    dataVersion = parsed.data.dataVersion;
    pages.set(key(entry.request), parsed.data);
  }
  const columns: BoardColumn[] = [];
  const visited = new Set<string>();
  const taskIds = new Set<string>();
  let pending = false;
  for (const status of statuses.items) {
    const tasks: Task[] = [];
    const cursors = new Set<string>();
    let cursor: string | undefined;
    let nextCursor: string | null = null;
    let current = pages.get(key({ statusId: status.id }));
    if (!current) pending = true;

    while (current) {
      visited.add(key({ statusId: status.id, cursor }));
      for (const task of current.items) {
        if (
          task.workspaceId !== input.workspaceId ||
          task.primaryListId !== input.listId ||
          task.statusId !== status.id ||
          task.archivedAt !== null ||
          taskIds.has(task.id) ||
          validateTaskFields({ fields: fields.data.items, values: task.customFields }).length > 0 ||
          (tasks.length > 0 && taskOrder(tasks[tasks.length - 1]!, task) > 0)
        )
          return { state: 'invalid' };

        taskIds.add(task.id);
        tasks.push(task);
      }
      nextCursor = current.pageInfo.nextCursor;
      if (nextCursor === null) break;

      if (cursors.has(nextCursor)) return { state: 'invalid' };

      cursors.add(nextCursor);
      cursor = nextCursor;
      current = pages.get(key({ statusId: status.id, cursor }));
    }
    columns.push({ status, tasks, nextCursor });
  }
  if (visited.size !== pages.size) return { state: 'invalid' };

  if (pending || dataVersion === undefined) return { state: 'pending' };

  return {
    state: 'ready',
    columns,
    fields: fields.data.items,
    configVersion: statuses.configVersion,
    dataVersion,
  };
}
