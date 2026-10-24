'use client';

import { StatusCategorySchema } from '@flowboard/contracts';
import { FormField } from '@flowboard/ui';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Controller } from 'react-hook-form';

import type { StatusDraft } from './status-form-data';
import type { Control } from 'react-hook-form';

export function StatusFields({
  control,
  busy,
  defining,
  canInherit,
}: {
  busy: boolean;
  canInherit: boolean;
  control: Control<StatusDraft>;
  defining: boolean;
}) {
  return (
    <Stack spacing={3}>
      {defining ? (
        <>
          <Controller
            name="key"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <FormField
                {...field}
                inputRef={ref}
                label="Status key"
                required
                disabled={busy}
                errorMessage={fieldState.error?.message}
                hint="Unique immutable key, such as review or waiting_for_qa."
              />
            )}
          />
          <Controller
            name="category"
            control={control}
            render={({ field: { ref, ...field }, fieldState }) => (
              <FormField
                {...field}
                inputRef={ref}
                label="Status category"
                select
                required
                disabled={busy}
                errorMessage={fieldState.error?.message}
                slotProps={{ select: { native: true } }}
              >
                {StatusCategorySchema.options.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </FormField>
            )}
          />
        </>
      ) : (
        <Typography variant="body2">
          The status key and category are immutable. Blank display fields inherit where an ancestor
          definition exists.
        </Typography>
      )}
      {(['name', 'color', 'position'] as const).map((name) => (
        <Controller
          key={name}
          name={name}
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              inputRef={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              value={field.value ?? ''}
              onChange={(event) =>
                field.onChange(
                  event.target.value === ''
                    ? null
                    : name === 'position'
                      ? Number(event.target.value)
                      : event.target.value,
                )
              }
              label={
                { name: 'Status name', color: 'Status color', position: 'Status position' }[name]
              }
              type={name === 'position' ? 'number' : 'text'}
              disabled={busy}
              required={!canInherit}
              errorMessage={fieldState.error?.message}
              hint={
                name === 'color'
                  ? 'Hex color, for example #334455.'
                  : canInherit
                    ? 'Leave blank to inherit.'
                    : undefined
              }
              slotProps={name === 'position' ? { htmlInput: { min: 0, step: 1 } } : undefined}
            />
          )}
        />
      ))}
      {!defining && (
        <Controller
          name="hidden"
          control={control}
          render={({ field, fieldState }) => (
            <FormField
              inputRef={field.ref}
              name={field.name}
              onBlur={field.onBlur}
              value={field.value === null ? 'inherit' : field.value ? 'hide' : 'show'}
              onChange={(event) =>
                field.onChange(
                  event.target.value === 'inherit' ? null : event.target.value === 'hide',
                )
              }
              label="Status visibility"
              select
              disabled={busy}
              errorMessage={fieldState.error?.message}
              slotProps={{ select: { native: true } }}
            >
              <option value="inherit">Inherit visibility</option>
              <option value="show">Show status</option>
              <option value="hide">Hide status</option>
            </FormField>
          )}
        />
      )}
    </Stack>
  );
}
