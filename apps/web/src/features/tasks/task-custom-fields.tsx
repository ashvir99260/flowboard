'use client';

import { CustomFieldInput } from '@flowboard/ui';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Controller } from 'react-hook-form';

import type { TaskDraft } from './task-form-data';
import type { ResolvedField } from '@flowboard/contracts';
import type { Control, UseFormSetFocus } from 'react-hook-form';

export function TaskCustomFields({
  fields,
  control,
  busy,
  setFocus,
}: {
  busy: boolean;
  control: Control<TaskDraft>;
  fields: readonly ResolvedField[];
  setFocus: UseFormSetFocus<TaskDraft>;
}) {
  return fields.map((definition) => (
    <Stack key={definition.id} spacing={1}>
      <Typography color="text.secondary" variant="caption">
        {definition.isInherited ? 'Inherited' : 'Local'}
      </Typography>
      <Controller
        name={`customFields.${definition.key}`}
        control={control}
        render={({ field, fieldState }) => (
          <Stack spacing={1}>
            <CustomFieldInput
              field={definition}
              inputRef={field.ref}
              onBlur={field.onBlur}
              value={field.value}
              onChange={field.onChange}
              disabled={busy}
              error={fieldState.error?.message}
            />
            {!definition.required && definition.type !== 'checkbox' && field.value !== null && (
              <Button
                type="button"
                disabled={busy}
                aria-label={`Clear ${definition.name}`}
                onClick={() => {
                  field.onChange(null);
                  setFocus(`customFields.${definition.key}`);
                }}
              >
                Clear
              </Button>
            )}
          </Stack>
        )}
      />
    </Stack>
  ));
}
