import { validateTaskFields } from '@flowboard/contracts';
import {
  getGridBooleanOperators,
  getGridDateOperators,
  getGridNumericOperators,
  getGridSingleSelectOperators,
  getGridStringOperators,
} from '@mui/x-data-grid';

import type { ResolvedField, Task } from '@flowboard/contracts';
import type { GridColDef, GridFilterModel } from '@mui/x-data-grid';

export type TaskTableSort = { direction: 'asc' | 'desc'; field: 'dueDate' | 'priority' };

export type TaskTableFilter = {
  key: string;
  operator: 'eq' | 'contains';
  value: string | number | boolean;
};

export type TaskTableControls = {
  disabled?: boolean;
  filter: TaskTableFilter | null;
  onFilterChange: (filter: TaskTableFilter | null) => void;
  onSortChange: (sort: TaskTableSort | null) => void;
  sort: TaskTableSort | null;
};

const filterOperators = {
  text: getGridStringOperators().find((operator) => operator.value === 'equals')!,
  number: getGridNumericOperators().find((operator) => operator.value === '=')!,
  checkbox: getGridBooleanOperators()[0]!,
  date: getGridDateOperators()[0]!,
  single_select: getGridSingleSelectOperators()[0]!,
  multi_select: getGridSingleSelectOperators()[0]!,
};
const columnTypes = {
  checkbox: 'boolean',
  date: 'date',
  multi_select: 'singleSelect',
  number: 'number',
  single_select: 'singleSelect',
  text: 'string',
} as const;

export function taskFieldColumn(field: ResolvedField): Partial<GridColDef<Task>> {
  const select = field.type === 'single_select' || field.type === 'multi_select';

  return {
    type: columnTypes[field.type],
    ...(select
      ? { valueOptions: field.options.map((option) => ({ value: option.id, label: option.label })) }
      : {}),
    filterOperators: [
      {
        ...filterOperators[field.type],
        value: field.type === 'multi_select' ? 'contains' : 'eq',
        label: field.type === 'multi_select' ? 'contains' : 'equals',
        getApplyFilterFn: () => null,
      },
    ],
  };
}

export function taskFilterModel(
  filter: TaskTableFilter | null,
  fields: readonly ResolvedField[],
): GridFilterModel {
  const field = fields.find((candidate) => candidate.key === filter?.key);
  const value =
    field &&
    ['single_select', 'multi_select'].includes(field.type) &&
    typeof filter?.value === 'string'
      ? filter.value.toLowerCase()
      : filter?.value;

  return {
    items: filter
      ? [{ id: filter.key, field: `custom:${filter.key}`, operator: filter.operator, value }]
      : [],
  };
}

export function readTaskFilter(model: GridFilterModel, fields: readonly ResolvedField[]) {
  const [item] = model.items;
  if (!item) return { complete: true, filter: null } as const;

  const field = fields.find((candidate) => `custom:${candidate.key}` === item.field);
  if (!field || item.operator !== (field.type === 'multi_select' ? 'contains' : 'eq'))
    return { complete: false } as const;

  const value =
    item.value instanceof Date && !Number.isNaN(item.value.valueOf())
      ? item.value.toISOString().slice(0, 10)
      : item.value;
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
    return { complete: false } as const;

  const issues = validateTaskFields({
    fields: [{ ...field, required: false }],
    values: { [field.key]: field.type === 'multi_select' ? [value] : value },
  });

  return issues.length
    ? ({ complete: false } as const)
    : ({
        complete: true,
        filter: {
          key: field.key,
          operator: field.type === 'multi_select' ? ('contains' as const) : ('eq' as const),
          value,
        },
      } as const);
}
