'use client';

import { FormField, SelectionInput, Stack, Surface } from '@flowboard/ui';
import { useState } from 'react';

export function CompactControlsExample() {
  const [order, setOrder] = useState('manual');

  return (
    <Surface.Root component="section">
      <Surface.Header>
        <Surface.Title component="h2">Compact controls</Surface.Title>
        <Surface.Description>
          Outlined menus and expanding notes share the same tokens.
        </Surface.Description>
      </Surface.Header>
      <Surface.Body>
        <Stack spacing={1.6}>
          <SelectionInput
            label="Compact menu"
            value={order}
            options={[
              { value: 'manual', label: 'Manual order' },
              { value: 'due', label: 'Due date' },
            ]}
            onChange={(value) => {
              if (typeof value === 'string') setOrder(value);
            }}
          />
          <FormField
            defaultValue={'First line\nSecond line'}
            label="Expanding notes"
            minRows={2}
            multiline
          />
        </Stack>
      </Surface.Body>
    </Surface.Root>
  );
}
