'use client';

import { ControlledField } from '@flowboard/forms';
import { Button, MarkdownContent, Stack } from '@flowboard/ui';
import { useState } from 'react';
import { useWatch } from 'react-hook-form';

import type { Control } from 'react-hook-form';
import type { TaskDraft } from './taskFormData';

export function TaskDescription({ control, busy }: { busy: boolean; control: Control<TaskDraft> }) {
  const description = useWatch({ control, name: 'description' });
  const [preview, setPreview] = useState(false);

  return (
    <Stack spacing={0.8}>
      <ControlledField
        control={control}
        disabled={busy}
        config={{
          kind: 'textarea',
          name: 'description',
          label: 'Description',
          minRows: 3,
          hint: 'Markdown is supported. Raw HTML is not rendered.',
        }}
      />
      <Button type="button" onClick={() => setPreview((value) => !value)}>
        {preview ? 'Hide preview' : 'Preview description'}
      </Button>
      {preview && <MarkdownContent>{description}</MarkdownContent>}
    </Stack>
  );
}
