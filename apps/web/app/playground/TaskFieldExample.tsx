'use client';

import { applyTaskFieldPatch, ResolvedFieldSchema } from '@flowboard/contracts';
import { ControlledField, customFieldConfig, useZodForm } from '@flowboard/forms';
import { Box, Button, CustomFieldChip, Paper, Stack, Typography } from '@flowboard/ui';
import { useState } from 'react';

import { taskFieldsSchema } from '../../src/forms/taskFieldsSchema';

import { options } from './formExampleData';

import type { TaskFieldsDraft } from '../../src/forms/taskFieldsSchema';
import type { FieldValues, ResolvedField } from '@flowboard/contracts';

const baseField = ResolvedFieldSchema.parse(ResolvedFieldSchema.meta()?.example);

export const fields: ResolvedField[] = [
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

export function TaskFieldExample() {
  const [saved, setSaved] = useState<FieldValues | null>(null);
  const { control, handleSubmit } = useZodForm(schema, {
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
  });

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2.4, minWidth: 0 }}>
      <Typography component="h2" variant="h3">
        Task field form
      </Typography>
      <Typography color="text.secondary" sx={{ my: 1.2 }}>
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
        <Stack spacing={2}>
          {fields.map((definition) => (
            <ControlledField
              key={definition.key}
              control={control}
              config={customFieldConfig<TaskFieldsDraft>(
                `customFields.${definition.key}`,
                definition,
              )}
            />
          ))}
          <Button type="submit" variant="contained">
            Preview fields
          </Button>
        </Stack>
      </Box>
      {saved && (
        <Stack component="output" aria-label="Saved field values" spacing={0.8} sx={{ mt: 1.6 }}>
          {fields.map((field) => (
            <CustomFieldChip key={field.key} field={field} value={saved[field.key]} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}
