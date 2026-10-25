'use client';

import { FieldKeySchema, FieldValueSchema } from '@flowboard/contracts';
import { Button, CustomFieldInput, SelectionInput, Stack } from '@flowboard/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { readListFilter } from './listFilter';

import type { TaskTableQuery } from './listLocation';
import type { ResolvedField } from '@flowboard/contracts';

const DraftSchema = z.strictObject({
  fieldKey: FieldKeySchema.or(z.literal('')),
  value: FieldValueSchema.nullable(),
});
type Draft = z.infer<typeof DraftSchema>;

function filterQuery(
  query: TaskTableQuery,
  draft: Draft,
  fields: readonly ResolvedField[],
): TaskTableQuery {
  const base = {
    sort: query.sort,
    direction: query.direction,
    ...(query.q === undefined ? {} : { q: query.q }),
  };
  if (!draft.fieldKey) return base;

  return {
    ...base,
    fieldKey: draft.fieldKey,
    fieldOperator:
      fields.find((field) => field.key === draft.fieldKey)?.type === 'multi_select'
        ? 'contains'
        : 'eq',
    fieldValue: JSON.stringify(draft.value),
  };
}

function initialValue(query: TaskTableQuery): Draft['value'] {
  try {
    const value = FieldValueSchema.safeParse(JSON.parse(query.fieldValue ?? 'null'));

    return value.success ? value.data : null;
  } catch {
    return null;
  }
}

export function CustomFieldFilter({
  fields,
  configured,
  query,
  onChange,
}: {
  configured: boolean;
  fields: readonly ResolvedField[];
  onChange: (query: TaskTableQuery) => void;
  query: TaskTableQuery;
}) {
  const schema = DraftSchema.superRefine((draft, context) => {
    const checked = readListFilter(filterQuery(query, draft, fields), fields);
    if (!checked.ok)
      context.addIssue({ code: 'custom', path: [checked.field], message: checked.message });
  });

  const { control, handleSubmit, reset, setValue } = useForm<Draft>({
    mode: 'onBlur',
    resolver: zodResolver(schema),
    defaultValues: { fieldKey: query.fieldKey ?? '', value: initialValue(query) },
  });
  const fieldKey = useWatch({ control, name: 'fieldKey' });

  const field = fields.find((item) => item.key === fieldKey);
  const inputField = field
    ? {
        ...field,
        required: true,
        type: field.type === 'multi_select' ? ('single_select' as const) : field.type,
      }
    : null;

  return (
    <Stack
      component="form"
      noValidate
      onSubmit={handleSubmit((draft) => onChange(filterQuery(query, draft, fields)))}
      direction={{ xs: 'column', md: 'row' }}
      spacing={0.8}
      sx={{ alignItems: { md: 'flex-start' } }}
    >
      <Controller
        name="fieldKey"
        control={control}
        render={({ field: { ref, ...input }, fieldState }) => (
          <SelectionInput
            {...input}
            inputRef={ref}
            label="Filter field"
            disabled={!configured}
            error={fieldState.error?.message}
            options={[
              { value: '', label: 'No filter' },
              ...fields.map((item) => ({ value: item.key, label: item.name })),
            ]}
            onChange={(value) => {
              if (typeof value !== 'string') return;

              input.onChange(value);
              setValue(
                'value',
                fields.find((item) => item.key === value)?.type === 'checkbox' ? false : null,
                { shouldDirty: true },
              );
            }}
          />
        )}
      />
      {inputField && (
        <Controller
          name="value"
          control={control}
          render={({ field: input, fieldState }) => (
            <CustomFieldInput
              field={inputField}
              inputRef={input.ref}
              value={
                inputField.type === 'single_select' && typeof input.value === 'string'
                  ? input.value.toLowerCase()
                  : input.value
              }
              onChange={input.onChange}
              onBlur={input.onBlur}
              disabled={!configured}
              error={fieldState.error?.message}
            />
          )}
        />
      )}
      <Button
        type="submit"
        variant="outlined"
        disabled={!configured}
        sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
      >
        Apply filter
      </Button>
      <Button
        disabled={!configured}
        sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        onClick={() => {
          reset({ fieldKey: '', value: null });
          onChange(filterQuery(query, { fieldKey: '', value: null }, fields));
        }}
      >
        Clear filter
      </Button>
    </Stack>
  );
}
