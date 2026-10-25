'use client';

import { FormFields, parseFormFields, useZodForm } from '@flowboard/forms';
import { Button, Paper, Stack, Typography } from '@flowboard/ui';
import { useState } from 'react';
import { z } from 'zod';

const JsonSchema = z.object({ label: z.string().trim().min(1, 'Enter a label') });

const jsonFields = parseFormFields<z.input<typeof JsonSchema>>(
  JSON.parse(
    '[{"kind":"text","name":"label","label":"Label","required":true,"hint":"Configured from JSON; validated with Zod."}]',
  ),
  ['label'],
);

export function JsonFormExample() {
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
