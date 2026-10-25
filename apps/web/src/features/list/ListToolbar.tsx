'use client';

import { FormField, Stack } from '@flowboard/ui';

import { CustomFieldFilter } from './CustomFieldFilter';
import { TaskSearch } from './TaskSearch';

import type { ResolvedField } from '@flowboard/contracts';
import type { TaskTableQuery } from './listLocation';

export function ListToolbar({
  fields,
  configured,
  query,
  onChange,
  pending,
}: {
  configured: boolean;
  fields: readonly ResolvedField[];
  onChange: (query: TaskTableQuery) => void;
  pending: boolean;
  query: TaskTableQuery;
}) {
  return (
    <Stack aria-busy={pending} spacing={1.2}>
      <TaskSearch key={query.q ?? ''} query={query} onChange={onChange} pending={pending} />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8}>
        <FormField
          label="Sort by"
          value={query.sort}
          disabled={pending}
          select
          slotProps={{ select: { native: true } }}
          onChange={(event) =>
            onChange({
              ...query,
              sort: event.target.value as TaskTableQuery['sort'],
              direction: event.target.value === 'manual' ? 'asc' : query.direction,
            })
          }
        >
          <option value="dueDate">Due date</option>
          <option value="priority">Priority</option>
          <option value="manual">Board order</option>
        </FormField>
        <FormField
          label="Direction"
          value={query.direction}
          select
          slotProps={{ select: { native: true } }}
          disabled={pending || query.sort === 'manual'}
          onChange={(event) =>
            onChange({ ...query, direction: event.target.value as TaskTableQuery['direction'] })
          }
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </FormField>
      </Stack>
      <CustomFieldFilter
        key={`${query.fieldKey ?? ''}:${query.fieldOperator ?? ''}:${query.fieldValue ?? ''}`}
        fields={fields}
        configured={configured && !pending}
        query={query}
        onChange={onChange}
      />
    </Stack>
  );
}
