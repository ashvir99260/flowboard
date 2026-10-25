'use client';

import { FormField, Stack, Surface } from '@flowboard/ui';

export function CompactControlsExample() {
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
          <FormField
            label="Compact menu"
            select
            defaultValue="manual"
            slotProps={{ select: { native: true } }}
          >
            <option value="manual">Manual order</option>
            <option value="due">Due date</option>
          </FormField>
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
