import type { Ref } from 'react';

export type SelectionValue = string | number | boolean | null;

export type SelectionOption = Readonly<{
  disabled?: boolean;
  label: string;
  value: SelectionValue;
}>;

type SelectionCommonProps = Readonly<{
  disabled?: boolean;
  error?: string;
  hint?: string;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  name?: string;
  onBlur?: () => void;
  onClear?: () => void;
  options: readonly SelectionOption[];
  required?: boolean;
}>;

export type SelectionInputProps = SelectionCommonProps &
  (
    | {
        multiple: true;
        onChange: (value: SelectionValue[]) => void;
        value: readonly SelectionValue[];
      }
    | { multiple?: false; onChange: (value: SelectionValue) => void; value: SelectionValue }
  );
