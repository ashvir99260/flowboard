'use client';

import { CustomFieldTypeSchema } from '@flowboard/contracts';
import { FormFields } from '@flowboard/forms';
import { Box, Button, Stack, Typography } from '@flowboard/ui';
import { useFieldArray, useWatch } from 'react-hook-form';

import type { UseFormReturn } from 'react-hook-form';
import type { FieldDraft } from './fieldFormData';

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
    setValue,
    setFocus,
    formState: { errors },
  } = form;

  const type = useWatch({ control, name: 'type' });
  const { fields: rows, append, move, remove } = useFieldArray({ control, name: 'options' });

  return (
    <Stack spacing={1.2}>
      <FormFields
        control={control}
        disabled={busy}
        fields={[
          {
            kind: 'text',
            name: 'key',
            label: 'Field key',
            required: true,
            disabled: editing,
            hint: 'Stable value key. A local definition replaces the inherited field with this key.',
          },
          { kind: 'text', name: 'name', label: 'Field name', required: true },
          {
            kind: 'number',
            name: 'position',
            label: 'Field position',
            required: true,
            emptyValue: 'nan',
          },
          {
            kind: 'select',
            name: 'type',
            label: 'Field type',
            required: true,
            options: CustomFieldTypeSchema.options.map((value) => ({ value, label: value })),
          },
          { kind: 'checkbox', name: 'required', label: 'Require a value on every task' },
        ]}
        onValueChange={(name, value) => {
          if (name !== 'type') return;

          const next = CustomFieldTypeSchema.parse(value);
          if (!['single_select', 'multi_select'].includes(next))
            setValue('options', [], { shouldDirty: true, shouldValidate: true });
        }}
      />
      <Typography variant="body2">
        Required means present; zero and false are valid. Changing type or options can be blocked by
        existing task values.
      </Typography>
      {['single_select', 'multi_select'].includes(type) && (
        <Stack component="section" aria-label="Field options" spacing={1.2}>
          <Typography component="h3" variant="h3">
            Options
          </Typography>
          {rows.map((row, index) => {
            return (
              <Box
                component="fieldset"
                key={row.id}
                sx={{ m: 0, p: 1.2, minWidth: 0, border: '1px solid', borderColor: 'divider' }}
              >
                <Typography component="legend">Option {index + 1}</Typography>
                <Stack spacing={0.8}>
                  <FormFields
                    control={control}
                    disabled={busy}
                    fields={[
                      {
                        kind: 'text',
                        name: `options.${index}.label`,
                        label: `Option ${index + 1} label`,
                        required: true,
                      },
                      {
                        kind: 'text',
                        name: `options.${index}.color`,
                        label: `Option ${index + 1} color`,
                        hint: 'Optional six-digit hex color; leave blank for neutral.',
                      },
                    ]}
                  />
                  {errors.options?.[index]?.id?.message && (
                    <Typography color="error" role="alert">
                      {errors.options[index]?.id?.message}
                    </Typography>
                  )}
                  <Stack direction="row" spacing={0.8} useFlexGap sx={{ flexWrap: 'wrap' }}>
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
                { id: crypto.randomUUID(), label: '' },
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
