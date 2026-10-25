import { z } from 'zod';

import { ControlledField } from '../src/ControlledField.js';
import { parseFormFields } from '../src/fieldConfig.js';
import { FormFields } from '../src/FormFields.js';
import { useZodForm } from '../src/useZodForm.js';

export function TypedExample() {
  const schema = z.object({
    profile: z.object({ name: z.string().transform((name) => name.length) }),
  });

  const form = useZodForm(schema, { defaultValues: { profile: { name: '' } } });

  form.handleSubmit((result) => {
    result.profile.name.toFixed();
  });

  // @ts-expect-error A transformed output cannot be used as the input default.
  useZodForm(schema, { defaultValues: { profile: { name: 1 } } });

  const invalid = (
    <ControlledField
      control={form.control}
      // @ts-expect-error A field must name an existing input path.
      config={{ kind: 'text', label: 'Missing', name: 'missing' }}
    />
  );
  const fields = parseFormFields<z.input<typeof schema>>([], ['profile.name']);
  const colorField = (
    <ControlledField
      control={form.control}
      config={{ kind: 'color', name: 'profile.name', label: 'Color', clearable: true }}
    />
  );

  return (
    <>
      <FormFields control={form.control} fields={fields} />
      {invalid}
      {colorField}
    </>
  );
}
