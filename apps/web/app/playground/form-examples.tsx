'use client';

import {
  applyTaskFieldPatch,
  CreateScopeFieldSchema,
  ResolvedFieldSchema,
} from '@flowboard/contracts';
import {
  ControlledField,
  customFieldConfig,
  FormFields,
  parseFormFields,
  useZodForm,
} from '@flowboard/forms';
import { Box, Button, Paper, Stack, Typography } from '@flowboard/ui';
import { CustomFieldChip } from '@flowboard/ui';
import { useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { z } from 'zod';

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

function OptionEditorExample() {
  const [saved, setSaved] = useState<CreateScopeField | null>(null);
  const { control, handleSubmit } = useZodForm(CreateScopeFieldSchema, {
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
  });
  const { fields: rows, append, move, remove } = useFieldArray({ control, name: 'options' });

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2.4, minWidth: 0 }}>
      <Typography component="h2" variant="h3">
        Option editor
      </Typography>
      <Typography color="text.secondary" sx={{ my: 1.2 }}>
        Labels can change and rows can move. Each option keeps its original identity.
      </Typography>
      <Box
        component="form"
        aria-label="Option editor example"
        noValidate
        onSubmit={handleSubmit(setSaved)}
      >
        <Stack spacing={2}>
          {rows.map((row, index) => {
            return (
              <Box
                key={row.id}
                component="fieldset"
                sx={{ m: 0, p: 1.2, border: '1px solid', borderColor: 'divider', minWidth: 0 }}
              >
                <Typography component="legend">Option {index + 1}</Typography>
                <ControlledField
                  control={control}
                  config={{ kind: 'text', name: `options.${index}.label`, label: 'Option label' }}
                />
                <Stack direction="row" useFlexGap spacing={0.8} sx={{ flexWrap: 'wrap', mt: 0.8 }}>
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
        <Stack component="output" aria-label="Saved options" spacing={0.8} sx={{ mt: 1.6 }}>
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

const JsonSchema = z.object({ label: z.string().trim().min(1, 'Enter a label') });
const jsonFields = parseFormFields<z.input<typeof JsonSchema>>(
  JSON.parse(
    '[{"kind":"text","name":"label","label":"Label","required":true,"hint":"Configured from JSON; validated with Zod."}]',
  ),
  ['label'],
);

function JsonFormExample() {
  const [saved, setSaved] = useState<string | null>(null);
  const { control, handleSubmit } = useZodForm(JsonSchema, { defaultValues: { label: '' } });

  return (
    <Paper component="section" variant="outlined" sx={{ p: 2.4, minWidth: 0 }}>
      <Typography component="h2" variant="h3">
        JSON-driven form
      </Typography>
      <Stack
        component="form"
        aria-label="JSON form example"
        noValidate
        spacing={1.2}
        sx={{ mt: 1.2 }}
        onSubmit={handleSubmit((value) => setSaved(value.label))}
      >
        <FormFields control={control} fields={jsonFields} />
        <Button type="submit" variant="contained">
          Preview JSON
        </Button>
      </Stack>
      {saved !== null && (
        <Typography aria-label="JSON result" component="output">
          {saved}
        </Typography>
      )}
    </Paper>
  );
}

export function FormExamples() {
  return (
    <>
      <JsonFormExample />
      <TaskFieldExample />
      <OptionEditorExample />
    </>
  );
}
