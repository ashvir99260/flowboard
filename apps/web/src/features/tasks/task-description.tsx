'use client';

import { FormField, MarkdownContent } from '@flowboard/ui';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useState } from 'react';
import { useController } from 'react-hook-form';

import type { TaskDraft } from './task-form-data';
import type { Control } from 'react-hook-form';

export function TaskDescription({ control, busy }: { busy: boolean; control: Control<TaskDraft> }) {
  const {
    field: { ref, ...input },
    fieldState,
  } = useController({ control, name: 'description' });
  const [preview, setPreview] = useState(false);

  return (
    <Stack spacing={2}>
      <FormField
        {...input}
        inputRef={ref}
        label="Description"
        multiline
        minRows={3}
        disabled={busy}
        errorMessage={fieldState.error?.message}
        hint="Markdown is supported. Raw HTML is not rendered."
      />
      <Button type="button" onClick={() => setPreview((value) => !value)}>
        {preview ? 'Hide preview' : 'Preview description'}
      </Button>
      {preview && <MarkdownContent>{input.value}</MarkdownContent>}
    </Stack>
  );
}
