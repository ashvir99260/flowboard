'use client';

import { ControlledField, customFieldConfig } from '@flowboard/forms';
import { Stack, Typography } from '@flowboard/ui';

import type { TaskDraft } from './taskFormData';
import type { ResolvedField } from '@flowboard/contracts';
import type { Control } from 'react-hook-form';

type TaskCustomFieldsProps = {
  busy: boolean;
  control: Control<TaskDraft>;
  fields: readonly ResolvedField[];
};

export function TaskCustomFields({ fields, control, busy }: TaskCustomFieldsProps) {
  return fields.map((definition) => (
    <Stack key={definition.id} spacing={0.4}>
      <Typography color="text.secondary" variant="caption">
        {definition.isInherited ? 'Inherited' : 'Local'}
      </Typography>
      <ControlledField
        control={control}
        disabled={busy}
        config={{
          ...customFieldConfig<TaskDraft>(`customFields.${definition.key}`, definition),
          clearable: true,
        }}
      />
    </Stack>
  ));
}
