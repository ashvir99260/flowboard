'use client';

import { ControlledField } from './ControlledField.js';
import { FormFieldsSchema } from './fieldConfig.js';

import type { ControlledFieldProps } from './ControlledField.js';
import type { FormFieldConfig } from './fieldConfig.js';
import type { FieldValues } from 'react-hook-form';

export function FormFields<T extends FieldValues, Output extends FieldValues = T>({
  fields,
  ...props
}: Omit<ControlledFieldProps<T, Output>, 'config'> & { fields: readonly FormFieldConfig<T>[] }) {
  const parsed = FormFieldsSchema.parse(fields) as FormFieldConfig<T>[];

  return parsed.map((config) => <ControlledField key={config.name} {...props} config={config} />);
}
