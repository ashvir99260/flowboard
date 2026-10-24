'use client';

import {
  applyTaskFieldPatch,
  CreateScopeFieldSchema,
  ResolvedFieldSchema,
} from '@flowboard/contracts';
import { Box, Button, Paper, Stack, Typography } from '@flowboard/ui';
import { CustomFieldChip, CustomFieldInput, FormField } from '@flowboard/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { taskFieldsSchema } from '../../src/forms/task-fields-schema';

import type { TaskFieldsDraft } from '../../src/forms/task-fields-schema';
import type { CreateScopeField, FieldValues, ResolvedField } from '@flowboard/contracts';

const options = [
  { id: '20000000-0000-4000-8000-000000000501', label: 'Design', color: '#245CC5' },
  { id: '20000000-0000-4000-8000-000000000502', label: 'Platform', color: '#146C43' },
];
const baseField = ResolvedFieldSchema.parse(ResolvedFieldSchema.meta()?.example);
const fields: ResolvedField[] = [
  { key: 'effort', name: 'Effort', type: 'number', required: false },
  { key: 'approved', name: 'Approved', type: 'checkbox', required: true },
  { key: 'notified', name: 'Notified', type: 'checkbox', required: false },
  { key: 'team', name: 'Team', type: 'single_select', required: true },
  { key: 'teams', name: 'Teams', type: 'multi_select', required: false },
  { key: 'release', name: 'Release', type: 'date', required: false },
  { key: 'notes', name: 'Notes', type: 'text', required: false },
].map((field, index) =>
  ResolvedFieldSchema.parse({
    ...baseField,
    ...field,
    id: `20000000-0000-4000-8000-00000000010${index}`,
    options: field.type.includes('select') ? options : [],
  }),
);
const schema = taskFieldsSchema(fields);

function TaskFieldExample() {
  const [saved, setSaved] = useState<FieldValues | null>(null);
  const { control, handleSubmit } = useForm<TaskFieldsDraft>({
    defaultValues: {
      customFields: {
        effort: 0,
        approved: false,
        notified: false,
        team: options[0]!.id,
        teams: [],
        release: null,
        notes: null,
      },
    },
    mode: 'onBlur',
    resolver: zodResolver(schema),
  });

  return (
    <Paper component="section" variant="outlined" sx={{ p: 6, minWidth: 0 }}>
      <Typography component="h2" variant="h3">
        Task field form
      </Typography>
      <Typography color="text.secondary" sx={{ my: 3 }}>
        Try zero, false, blank and invalid values. Preview uses the shared domain rules.
      </Typography>
      <Box
        component="form"
        aria-label="Task field example"
        noValidate
        onSubmit={handleSubmit(({ customFields }) => {
          const result = applyTaskFieldPatch({ current: {}, fields, patch: customFields });
          if (result.success) setSaved(result.values);
        })}
      >
        <Stack spacing={5}>
          {fields.map((definition) => (
            <Controller
              key={definition.key}
              control={control}
              name={`customFields.${definition.key}`}
              render={({ field, fieldState }) => (
                <CustomFieldInput
                  field={definition}
                  value={field.value ?? null}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  inputRef={field.ref}
                  error={fieldState.error?.message}
                />
              )}
            />
          ))}
          <Button type="submit" variant="contained">
            Preview fields
          </Button>
        </Stack>
      </Box>
      {saved && (
        <Stack component="output" aria-label="Saved field values" spacing={2} sx={{ mt: 4 }}>
          {fields.map((field) => (
            <CustomFieldChip key={field.key} field={field} value={saved[field.key]} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

function OptionEditorExample() {
  const [saved, setSaved] = useState<CreateScopeField | null>(null);
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateScopeField>({
    defaultValues: {
      key: 'team',
      name: 'Team',
      type: 'single_select',
      required: false,
      options,
      position: 0,
      expectedConfigVersion: 1,
    },
    mode: 'onBlur',
    resolver: zodResolver(CreateScopeFieldSchema),
  });
  const { fields: rows, append, move, remove } = useFieldArray({ control, name: 'options' });

  return (
    <Paper component="section" variant="outlined" sx={{ p: 6, minWidth: 0 }}>
      <Typography component="h2" variant="h3">
        Option editor
      </Typography>
      <Typography color="text.secondary" sx={{ my: 3 }}>
        Labels can change and rows can move. Each option keeps its original identity.
      </Typography>
      <Box
        component="form"
        aria-label="Option editor example"
        noValidate
        onSubmit={handleSubmit(setSaved)}
      >
        <Stack spacing={5}>
          {rows.map((row, index) => {
            const { ref, ...registration } = register(`options.${index}.label`);

            return (
              <Box
                key={row.id}
                component="fieldset"
                sx={{ m: 0, p: 3, border: '1px solid', borderColor: 'divider', minWidth: 0 }}
              >
                <Typography component="legend">Option {index + 1}</Typography>
                <FormField
                  label="Option label"
                  {...registration}
                  inputRef={ref}
                  errorMessage={errors.options?.[index]?.label?.message}
                />
                <Stack direction="row" useFlexGap spacing={2} sx={{ flexWrap: 'wrap', mt: 2 }}>
                  <Button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={`Move option ${index + 1} up`}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    disabled={index === rows.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={`Move option ${index + 1} down`}
                  >
                    Down
                  </Button>
                  <Button
                    type="button"
                    onClick={() => remove(index)}
                    aria-label={`Remove option ${index + 1}`}
                  >
                    Remove
                  </Button>
                </Stack>
              </Box>
            );
          })}
          <Button
            type="button"
            onClick={() => append({ id: crypto.randomUUID(), label: '', color: '#245CC5' })}
          >
            Add option
          </Button>
          <Button type="submit" variant="contained">
            Preview options
          </Button>
        </Stack>
      </Box>
      {saved && (
        <Stack component="output" aria-label="Saved options" spacing={2} sx={{ mt: 4 }}>
          {saved.options.map((option) => (
            <Box key={option.id}>
              <Typography>{option.label}</Typography>
              <Typography color="text.secondary" variant="body2">
                {option.id}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}
    </Paper>
  );
}

export function FormExamples() {
  return (
    <>
      <TaskFieldExample />
      <OptionEditorExample />
    </>
  );
}
