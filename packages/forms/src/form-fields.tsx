'use client';

import { ControlledField } from './controlled-field.js';
import { FormFieldsSchema } from './field-config.js';

import type { ControlledFieldProps } from './controlled-field.js';
import type { FormFieldConfig } from './field-config.js';
import type { FieldValues } from 'react-hook-form';

export function FormFields<T extends FieldValues, Output extends FieldValues = T>({
  fields,
  ...props
}: Omit<ControlledFieldProps<T, Output>, 'config'> & { fields: readonly FormFieldConfig<T>[] }) {
  const parsed = FormFieldsSchema.parse(fields) as FormFieldConfig<T>[];

  return parsed.map((config) => <ControlledField key={config.name} {...props} config={config} />);
}
