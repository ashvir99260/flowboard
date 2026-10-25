'use client';

import { Button, CustomFieldInput, DateInput, FormField, Stack } from '@flowboard/ui';
import { useRef } from 'react';
import { useController } from 'react-hook-form';

import { CheckboxInput } from './CheckboxInput.js';
import { ColorInput } from './ColorInput.js';
import { SelectInput } from './SelectInput.js';

import type { FormFieldConfig, SelectValue } from './fieldConfig.js';
import type { FieldValue } from '@flowboard/contracts';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

export type ControlledFieldProps<T extends FieldValues, Output extends FieldValues = T> = {
  config: FormFieldConfig<T>;
  control: Control<T, unknown, Output>;
  disabled?: boolean;
  onValueChange?: (name: FieldPath<T>, value: unknown) => void;
};

export function ControlledField<T extends FieldValues, Output extends FieldValues = T>({
  config,
  control,
  disabled,
  onValueChange,
}: ControlledFieldProps<T, Output>) {
  // Visual disabling must not omit a registered value from a submitted draft.
  const { field, fieldState } = useController({ control, name: config.name });
  const input = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const inputRef = (element: HTMLInputElement | HTMLSelectElement | null) => {
    input.current = element;
    field.ref(element);
  };
  const change = (value: unknown) => {
    field.onChange(value);
    onValueChange?.(config.name, value);
  };
  const isDisabled = disabled || config.disabled;
  if (config.kind === 'color')
    return (
      <ColorInput
        clearable={config.clearable}
        clearLabel={config.clearLabel}
        disabled={isDisabled}
        error={fieldState.error?.message}
        hint={config.hint}
        inputRef={inputRef}
        label={config.label}
        name={field.name}
        onBlur={field.onBlur}
        onChange={change}
        onClear={() => {
          change(null);
          input.current?.focus();
        }}
        required={config.required}
        value={field.value ?? null}
      />
    );

  if (config.kind === 'select' || config.kind === 'multi_select')
    return (
      <SelectInput
        disabled={isDisabled}
        error={fieldState.error?.message}
        hint={config.hint}
        inputRef={inputRef}
        label={config.label}
        multiple={config.kind === 'multi_select'}
        name={field.name}
        onBlur={field.onBlur}
        onChange={change}
        options={config.options}
        required={config.required}
        value={
          (field.value ?? (config.kind === 'multi_select' ? [] : null)) as
            SelectValue | SelectValue[]
        }
      />
    );

  if (config.kind === 'checkbox')
    return (
      <CheckboxInput
        checked={field.value === true}
        disabled={isDisabled}
        error={fieldState.error?.message}
        hint={config.hint}
        inputRef={inputRef}
        label={config.label}
        name={field.name}
        onBlur={field.onBlur}
        onChange={change}
        required={config.required}
      />
    );

  if (config.kind === 'custom' || config.kind === 'number') {
    const definition =
      config.kind === 'custom'
        ? { ...config.definition, key: field.name, name: config.label }
        : {
            key: field.name,
            name: config.label,
            type: config.kind,
            required: Boolean(config.required),
            options: [],
          };

    return (
      <Stack spacing={0.4}>
        <CustomFieldInput
          hint={config.hint}
          field={definition}
          disabled={isDisabled}
          error={fieldState.error?.message}
          inputRef={inputRef}
          onBlur={field.onBlur}
          onChange={(value) =>
            change(
              config.kind === 'number' && value === null && config.emptyValue === 'nan'
                ? Number.NaN
                : value,
            )
          }
          value={
            (typeof field.value === 'number' && Number.isNaN(field.value)
              ? null
              : (field.value ?? null)) as FieldValue | null
          }
        />
        {config.kind === 'custom' &&
          config.clearable &&
          !definition.required &&
          !['checkbox', 'single_select', 'multi_select', 'date'].includes(definition.type) &&
          field.value !== null && (
            <Button
              type="button"
              disabled={isDisabled}
              aria-label={`Clear ${config.label}`}
              onClick={() => {
                change(null);
                input.current?.focus();
              }}
            >
              Clear
            </Button>
          )}
      </Stack>
    );
  }

  if (config.kind === 'date' || config.kind === 'datetime-local')
    return (
      <DateInput
        disabled={isDisabled}
        error={fieldState.error?.message}
        hint={config.hint}
        inputRef={inputRef}
        kind={config.kind}
        label={config.label}
        name={field.name}
        onBlur={field.onBlur}
        onChange={(value) => change(value ?? (config.emptyValue === 'null' ? null : ''))}
        required={config.required}
        value={field.value || null}
      />
    );

  return (
    <FormField
      autoComplete={config.autoComplete}
      disabled={isDisabled}
      errorMessage={fieldState.error?.message}
      hint={config.hint}
      inputRef={inputRef}
      label={config.label}
      minRows={config.kind === 'textarea' ? (config.minRows ?? 3) : undefined}
      multiline={config.kind === 'textarea'}
      name={field.name}
      onBlur={field.onBlur}
      onChange={(event) =>
        change(
          event.target.value === '' && config.emptyValue === 'null' ? null : event.target.value,
        )
      }
      required={config.required}
      type={config.kind === 'textarea' ? 'text' : config.kind}
      value={field.value ?? ''}
    />
  );
}
