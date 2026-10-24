'use client';

import { CustomFieldTypeSchema } from '@flowboard/contracts';
import { Box, Button, Checkbox, FormControlLabel, Stack, Typography } from '@flowboard/ui';
import { FormField } from '@flowboard/ui';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';

import type { FieldDraft } from './field-form-data';
import type { UseFormReturn } from 'react-hook-form';

export function FieldInputs({
  form,
  busy,
  editing,
}: {
  busy: boolean;
  editing: boolean;
  form: UseFormReturn<FieldDraft>;
}) {
  const {
    control,
    register,
    setValue,
    setFocus,
    formState: { errors },
  } = form;
  const type = useWatch({ control, name: 'type' });
  const { fields: rows, append, move, remove } = useFieldArray({ control, name: 'options' });

  return (
    <Stack spacing={3}>
      {(['key', 'name', 'position'] as const).map((name) => (
        <Controller
          key={name}
          name={name}
          control={control}
          render={({ field: { ref, ...field }, fieldState }) => (
            <FormField
              {...field}
              inputRef={ref}
              label={{ key: 'Field key', name: 'Field name', position: 'Field position' }[name]}
              required
              disabled={busy || (name === 'key' && editing)}
              type={name === 'position' ? 'number' : 'text'}
              onChange={(event) =>
                field.onChange(
                  name === 'position'
                    ? event.target.value === ''
                      ? Number.NaN
                      : Number(event.target.value)
                    : event.target.value,
                )
              }
              errorMessage={fieldState.error?.message}
              hint={
                name === 'key'
                  ? 'Stable value key. A local definition replaces the inherited field with this key.'
                  : undefined
              }
              slotProps={name === 'position' ? { htmlInput: { min: 0, step: 1 } } : undefined}
            />
          )}
        />
      ))}
      <Controller
        name="type"
        control={control}
        render={({ field: { ref, ...field }, fieldState }) => (
          <FormField
            {...field}
            inputRef={ref}
            label="Field type"
            select
            required
            disabled={busy}
            errorMessage={fieldState.error?.message}
            slotProps={{ select: { native: true } }}
            onChange={(event) => {
              const next = CustomFieldTypeSchema.parse(event.target.value);
              field.onChange(next);
              if (!['single_select', 'multi_select'].includes(next))
                setValue('options', [], { shouldDirty: true, shouldValidate: true });
            }}
          >
            {CustomFieldTypeSchema.options.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </FormField>
        )}
      />
      <Controller
        name="required"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            label="Require a value on every task"
            control={
              <Checkbox
                checked={field.value}
                disabled={busy}
                onBlur={field.onBlur}
                onChange={(event) => field.onChange(event.target.checked)}
                slotProps={{ input: { ref: field.ref, name: field.name } }}
              />
            }
          />
        )}
      />
      <Typography variant="body2">
        Required means present; zero and false are valid. Changing type or options can be blocked by
        existing task values.
      </Typography>
      {['single_select', 'multi_select'].includes(type) && (
        <Stack component="section" aria-label="Field options" spacing={3}>
          <Typography component="h3" variant="h3">
            Options
          </Typography>
          {rows.map((row, index) => {
            const { ref: labelRef, ...label } = register(`options.${index}.label`);
            const { ref: colorRef, ...color } = register(`options.${index}.color`);

            return (
              <Box
                component="fieldset"
                key={row.id}
                sx={{ m: 0, p: 3, minWidth: 0, border: '1px solid', borderColor: 'divider' }}
              >
                <Typography component="legend">Option {index + 1}</Typography>
                <Stack spacing={2}>
                  <FormField
                    {...label}
                    inputRef={labelRef}
                    label={`Option ${index + 1} label`}
                    required
                    disabled={busy}
                    errorMessage={errors.options?.[index]?.label?.message}
                  />
                  <FormField
                    {...color}
                    inputRef={colorRef}
                    label={`Option ${index + 1} color`}
                    required
                    disabled={busy}
                    errorMessage={errors.options?.[index]?.color?.message}
                    hint="Six-digit hex color, for example #334455."
                  />
                  {errors.options?.[index]?.id?.message && (
                    <Typography color="error" role="alert">
                      {errors.options[index]?.id?.message}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      disabled={busy || index === 0}
                      aria-label={`Move option ${index + 1} up`}
                      onClick={() => {
                        move(index, index - 1);
                        requestAnimationFrame(() => setFocus(`options.${index - 1}.label`));
                      }}
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      disabled={busy || index === rows.length - 1}
                      aria-label={`Move option ${index + 1} down`}
                      onClick={() => {
                        move(index, index + 1);
                        requestAnimationFrame(() => setFocus(`options.${index + 1}.label`));
                      }}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      disabled={busy}
                      aria-label={`Remove option ${index + 1}`}
                      onClick={() => {
                        remove(index);
                        requestAnimationFrame(() =>
                          setFocus(
                            rows.length > 1
                              ? `options.${Math.min(index, rows.length - 2)}.label`
                              : 'name',
                          ),
                        );
                      }}
                    >
                      Remove
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            );
          })}
          {errors.options?.root?.message && (
            <Typography color="error" role="alert">
              {errors.options.root.message}
            </Typography>
          )}
          <Button
            type="button"
            disabled={busy || rows.length >= 100}
            onClick={() =>
              append(
                { id: crypto.randomUUID(), label: '', color: '#334455' },
                { focusName: `options.${rows.length}.label` },
              )
            }
          >
            Add option
          </Button>
        </Stack>
      )}
    </Stack>
  );
}
