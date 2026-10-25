'use client';

import type { CreateScopeField } from '@flowboard/contracts';
import { CreateScopeFieldSchema } from '@flowboard/contracts';
import { ControlledField, useZodForm } from '@flowboard/forms';
import { Box, Button, Paper, Stack, Typography } from '@flowboard/ui';
import { useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import { options } from './formExampleData';

export function OptionEditorExample() {
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
