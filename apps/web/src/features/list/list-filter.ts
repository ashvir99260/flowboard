import { ListTasksQuerySchema, validateTaskFields } from '@flowboard/contracts';

import type { TaskTableQuery } from './list-location';
import type { ResolvedField } from '@flowboard/contracts';

export function readListFilter(
  query: TaskTableQuery,
  fields: readonly ResolvedField[],
):
  | { ok: true; value?: string | number | boolean }
  | { field: 'fieldKey' | 'value'; message: string; ok: false } {
  const parsed = ListTasksQuerySchema.safeParse(query);
  if (!parsed.success)
    return { field: 'fieldKey', message: 'Choose a field and its filter value.', ok: false };

  if (query.fieldKey === undefined) return { ok: true };

  const field = fields.find((item) => item.key === query.fieldKey);
  if (!field)
    return { field: 'fieldKey', message: 'This field is unavailable in this list.', ok: false };

  if ((query.fieldOperator === 'contains') !== (field.type === 'multi_select'))
    return { field: 'value', message: 'The filter operator does not match this field.', ok: false };

  let value: unknown;
  try {
    value = JSON.parse(query.fieldValue!);
  } catch {
    return { field: 'value', message: 'The filter value is not valid JSON.', ok: false };
  }
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean')
    return { field: 'value', message: 'Choose one non-empty scalar filter value.', ok: false };

  const issues = validateTaskFields({
    fields: [{ ...field, required: false }],
    values: { [field.key]: query.fieldOperator === 'contains' ? [value] : value },
  });
  if (issues.length)
    return { field: 'value', message: 'The filter value does not match this field.', ok: false };

  return { ok: true, value };
}
