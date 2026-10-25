'use client';

import { SelectionInput } from '@flowboard/ui';

import type { SelectValue } from './fieldConfig.js';

type Props = {
  disabled?: boolean;
  error?: string;
  hint?: string;
  inputRef: (element: HTMLInputElement | null) => void;
  label: string;
  multiple: boolean;
  name: string;
  onBlur: () => void;
  onChange: (value: SelectValue | SelectValue[]) => void;
  options: readonly { label: string; value: SelectValue }[];
  required?: boolean;
  value: SelectValue | SelectValue[];
};

export function SelectInput({ multiple, value, ...props }: Props) {
  return multiple ? (
    <SelectionInput {...props} multiple value={Array.isArray(value) ? value : []} />
  ) : (
    <SelectionInput {...props} value={Array.isArray(value) ? null : value} />
  );
}
