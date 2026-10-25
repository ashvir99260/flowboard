'use client';

import { StatusCategorySchema } from '@flowboard/contracts';
import { FormFields } from '@flowboard/forms';
import { Stack, Typography } from '@flowboard/ui';

import type { FormFieldConfig } from '@flowboard/forms';
import type { Control } from 'react-hook-form';
import type { StatusDraft } from './statusFormData';

export function StatusFields({
  control,
  busy,
  defining,
  canInherit,
}: {
  busy: boolean;
  canInherit: boolean;
  control: Control<StatusDraft>;
  defining: boolean;
}) {
  const displayFields: FormFieldConfig<StatusDraft>[] = [
    {
      kind: 'text',
      name: 'name',
      label: 'Status name',
      emptyValue: 'null',
      required: !canInherit,
      hint: canInherit ? 'Leave blank to inherit.' : undefined,
    },
    {
      kind: 'text',
      name: 'color',
      label: 'Status color',
      emptyValue: 'null',
      required: !canInherit,
      hint: 'Hex color, for example #334455.',
    },
    {
      kind: 'number',
      name: 'position',
      label: 'Status position',
      required: !canInherit,
      hint: canInherit ? 'Leave blank to inherit.' : undefined,
    },
  ];

  return (
    <Stack spacing={1.2}>
      {defining ? (
        <FormFields
          control={control}
          disabled={busy}
          fields={[
            {
              kind: 'text',
              name: 'key',
              label: 'Status key',
              required: true,
              hint: 'Unique immutable key, such as review or waiting_for_qa.',
            },
            {
              kind: 'select',
              name: 'category',
              label: 'Status category',
              required: true,
              options: StatusCategorySchema.options.map((value) => ({ value, label: value })),
            },
          ]}
        />
      ) : (
        <Typography variant="body2">
          The status key and category are immutable. Blank display fields inherit where an ancestor
          definition exists.
        </Typography>
      )}
      <FormFields control={control} disabled={busy} fields={displayFields} />
      {!defining && (
        <FormFields
          control={control}
          disabled={busy}
          fields={[
            {
              kind: 'select',
              name: 'hidden',
              label: 'Status visibility',
              options: [
                { value: null, label: 'Inherit visibility' },
                { value: false, label: 'Show status' },
                { value: true, label: 'Hide status' },
              ],
            },
          ]}
        />
      )}
    </Stack>
  );
}
