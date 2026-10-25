'use client';
import { TaskTable as Table } from '@flowboard/ui';

import { useTaskEditor } from '../tasks/useTaskEditor';

import { readListFilter } from './listFilter';

import type { TaskTableQuery } from './listLocation';
import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';
import type { TaskTableControls } from '@flowboard/ui';

export function TaskTable({
  query,
  onChange,
  pending,
  loading,
  ...props
}: {
  fields: readonly ResolvedField[];
  items: readonly Task[];
  loading: boolean;
  onChange: (query: TaskTableQuery) => void;
  pending: boolean;
  query: TaskTableQuery;
  selection?: {
    disabled?: boolean;
    ids: readonly string[];
    onChange: (ids: string[]) => void;
  };
  statuses: readonly ResolvedStatus[];
}) {
  const openTask = useTaskEditor();

  const filter = readListFilter(query, props.fields);
  const controls: TaskTableControls = {
    sort: query.sort === 'manual' ? null : { field: query.sort, direction: query.direction },
    filter:
      query.fieldKey && query.fieldOperator && filter.ok && filter.value !== undefined
        ? { key: query.fieldKey, operator: query.fieldOperator, value: filter.value }
        : null,
    onSortChange: (sort) =>
      onChange({
        ...query,
        sort: sort?.field ?? 'manual',
        direction: sort?.direction ?? 'asc',
      }),
    onFilterChange: (next) =>
      onChange({
        ...(query.q === undefined ? {} : { q: query.q }),
        sort: query.sort,
        direction: query.direction,
        ...(next
          ? {
              fieldKey: next.key,
              fieldOperator: next.operator,
              fieldValue: JSON.stringify(next.value),
            }
          : {}),
      }),
  };

  return (
    <Table {...props} controls={controls} loading={pending || loading} onOpenTask={openTask} />
  );
}
