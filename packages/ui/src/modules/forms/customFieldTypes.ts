import type { FieldValue, ResolvedField } from '@flowboard/contracts';

export type CustomFieldInputProps = Readonly<{
  disabled?: boolean;
  error?: string;
  field: Pick<ResolvedField, 'key' | 'name' | 'type' | 'required' | 'options'>;
  hint?: string;
  inputRef?: (element: HTMLInputElement | HTMLSelectElement | null) => void;
  onBlur?: () => void;
  onChange: (value: FieldValue | null) => void;
  value: FieldValue | null;
}>;
