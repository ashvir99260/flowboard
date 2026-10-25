'use client';

import MuiAutocomplete from '@mui/material/Autocomplete';
import { styled } from '@mui/material/styles';
import { useId } from 'react';

import { TextField } from '../primitives/TextField.js';

import type { SelectionInputProps, SelectionOption } from './selectionTypes.js';

const SelectionControl = styled(MuiAutocomplete, {
  name: 'FlowboardSelectionInput',
  slot: 'Root',
})({
  '& .MuiAutocomplete-inputRoot': {
    padding: '0.3rem 0.8rem',
    '& .MuiAutocomplete-input': { padding: '0.2rem 0.4rem', minWidth: '3rem' },
  },
}) as typeof MuiAutocomplete;

export function SelectionInput(props: SelectionInputProps) {
  const id = useId();

  const { disabled, error, hint, inputRef, label, name, onBlur, options, required } = props;
  const selected = props.multiple ? props.value : [props.value];
  const unavailable = selected.filter(
    (value) =>
      (props.multiple || value !== null) &&
      !options.some((option) => Object.is(option.value, value)),
  );
  const allOptions: SelectionOption[] = [
    ...options,
    ...unavailable.map((value) => ({ label: `Unavailable option (${String(value)})`, value })),
  ];
  const selection = selected.flatMap((value) => {
    const option = allOptions.find((item) => Object.is(item.value, value));

    return option ? [option] : [];
  });
  const message = error ?? (unavailable.length ? 'Selected option is no longer available' : hint);

  return (
    <SelectionControl<SelectionOption, boolean, false, false>
      id={id}
      clearText={`Clear ${label}`}
      disabled={disabled}
      disableCloseOnSelect={props.multiple}
      fullWidth
      getOptionDisabled={(option) => Boolean(option.disabled)}
      getOptionKey={(option) => `${typeof option.value}:${String(option.value)}`}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, value) => Object.is(option.value, value.value)}
      multiple={Boolean(props.multiple)}
      onBlur={onBlur}
      onChange={(_event, next, reason) => {
        if (reason === 'clear' && props.onClear) {
          props.onClear();

          return;
        }

        if (props.multiple) {
          props.onChange(Array.isArray(next) ? next.map((option) => option.value) : []);

          return;
        }

        props.onChange(next && !Array.isArray(next) ? next.value : null);
      }}
      options={allOptions}
      slotProps={{ clearIndicator: { sx: { visibility: 'visible' } } }}
      value={props.multiple ? selection : (selection[0] ?? null)}
      renderInput={(params) => (
        <TextField
          {...params}
          error={Boolean(error || unavailable.length)}
          helperText={message}
          inputRef={inputRef}
          label={label}
          name={name}
          required={required}
          slotProps={{
            ...params.slotProps,
            htmlInput: {
              ...params.slotProps.htmlInput,
              'aria-required': required,
              required: required && selection.length === 0,
            },
          }}
        />
      )}
    />
  );
}
