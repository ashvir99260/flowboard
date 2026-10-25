'use client';

import { SelectionInput, Stack } from '@flowboard/ui';

import { CustomFieldFilter } from './CustomFieldFilter';
import { TaskSearch } from './TaskSearch';

import type { TaskTableQuery } from './listLocation';
import type { ResolvedField } from '@flowboard/contracts';

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
        <SelectionInput
          label="Sort by"
          value={query.sort}
          disabled={pending}
          options={[
            { value: 'dueDate', label: 'Due date' },
            { value: 'priority', label: 'Priority' },
            { value: 'manual', label: 'Board order' },
          ]}
          onChange={(value) => {
            if (value !== 'dueDate' && value !== 'priority' && value !== 'manual') return;

            onChange({
              ...query,
              sort: value,
              direction: value === 'manual' ? 'asc' : query.direction,
            });
          }}
        />
        <SelectionInput
          label="Direction"
          value={query.direction}
          disabled={pending || query.sort === 'manual'}
          options={[
            { value: 'asc', label: 'Ascending' },
            { value: 'desc', label: 'Descending' },
          ]}
          onChange={(value) => {
            if (value !== 'asc' && value !== 'desc') return;

            onChange({ ...query, direction: value });
          }}
        />
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
