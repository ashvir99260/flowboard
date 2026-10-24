import { ListTasksQuerySchema } from '@flowboard/contracts';

import type { ListTasksQuery } from '@flowboard/contracts';

export type TaskTableQuery = Pick<
  ListTasksQuery,
  'sort' | 'direction' | 'fieldKey' | 'fieldOperator' | 'fieldValue'
>;

const keys = ['sort', 'direction', 'fieldKey', 'fieldOperator', 'fieldValue'] as const;
const queryKeys = new Set<string>(keys);
const allowedKeys = new Set(['view', ...keys]);

export function readListLocation(
  search: string,
): { ok: true; query: TaskTableQuery; view: 'board' | 'list' } | { message: string; ok: false } {
  const params = new URLSearchParams(search);
  if (
    [...params.keys()].some((key) => !allowedKeys.has(key)) ||
    [...new Set(params.keys())].some((key) => params.getAll(key).length > 1)
  )
    return { message: 'Unknown or repeated list options. Reset the view to continue.', ok: false };

  const view = params.get('view') ?? 'board';
  if (view !== 'board' && view !== 'list')
    return { message: 'Choose the board or list view.', ok: false };

  if (view === 'board' && keys.some((key) => params.has(key)))
    return { message: 'Sort and filter options require the list view.', ok: false };

  const parsed = ListTasksQuerySchema.safeParse({
    sort: 'dueDate',
    direction: 'asc',
    ...Object.fromEntries([...params].filter(([key]) => queryKeys.has(key))),
  });
  if (!parsed.success)
    return { message: 'Invalid sort or incomplete filter. Reset the view to continue.', ok: false };

  const { sort, direction, fieldKey, fieldOperator, fieldValue } = parsed.data;

  return {
    ok: true,
    view,
    query: {
      sort,
      direction,
      ...(fieldKey === undefined ? {} : { fieldKey, fieldOperator, fieldValue }),
    },
  };
}

export function writeListLocation(query: TaskTableQuery, view: 'board' | 'list' = 'list') {
  if (view === 'board') return '';

  const params = new URLSearchParams({ view });
  for (const key of keys) {
    const value = query[key];
    if (value !== undefined) params.set(key, value);
  }
  if (!readListLocation(params.toString()).ok) throw new Error('Invalid list options');

  return params.toString();
}
