'use client';

import { textSchema } from '@flowboard/contracts';
import { FormFields, useZodForm } from '@flowboard/forms';
import { Button, Stack } from '@flowboard/ui';
import { z } from 'zod';

import type { TaskTableQuery } from './listLocation';

const SearchSchema = z.strictObject({ q: textSchema(200, 0, true) });

export function TaskSearch({
  query,
  onChange,
  pending,
}: {
  onChange: (query: TaskTableQuery) => void;
  pending: boolean;
  query: TaskTableQuery;
}) {
  const { control, handleSubmit, reset } = useZodForm(SearchSchema, {
    defaultValues: { q: query.q ?? '' },
  });
  const withoutSearch = { ...query };
  delete withoutSearch.q;

  return (
    <Stack
      component="form"
      noValidate
      direction={{ xs: 'column', sm: 'row' }}
      spacing={0.8}
      onSubmit={handleSubmit(({ q }) => onChange(q ? { ...withoutSearch, q } : withoutSearch))}
    >
      <FormFields
        control={control}
        disabled={pending}
        fields={[{ kind: 'text', name: 'q', label: 'Search tasks' }]}
      />
      <Button type="submit" disabled={pending}>
        Search
      </Button>
      <Button
        disabled={pending || !query.q}
        onClick={() => {
          reset({ q: '' });
          onChange(withoutSearch);
        }}
      >
        Clear search
      </Button>
    </Stack>
  );
}
