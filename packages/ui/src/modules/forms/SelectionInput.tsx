'use client';

import MuiAutocomplete from '@mui/material/Autocomplete';
import { styled } from '@mui/material/styles';
import { useId, useState } from 'react';

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
  '& .MuiAutocomplete-inputRoot.MuiOutlinedInput-root.MuiInputBase-sizeSmall': {
    paddingBlock: '0.3rem',
  },
}) as typeof MuiAutocomplete;

export function SelectionInput(props: SelectionInputProps) {
  const id = useId();
  const [searching, setSearching] = useState(false);

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

  const [stableSelection, setStableSelection] = useState(selection);

  const unchanged =
    stableSelection.length === selection.length &&
    stableSelection.every(
      (option, index) =>
        Object.is(option.value, selection[index]!.value) &&
        (searching ||
          (option.label === selection[index]!.label &&
            option.disabled === selection[index]!.disabled)),
    );
  if (!unchanged) setStableSelection(selection);

  const currentSelection = unchanged ? stableSelection : selection;
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
      getOptionLabel={(option) =>
        allOptions.find((current) => Object.is(current.value, option.value))?.label ?? option.label
      }
      isOptionEqualToValue={(option, value) => Object.is(option.value, value.value)}
      multiple={Boolean(props.multiple)}
      onBlur={() => {
        setSearching(false);
        onBlur?.();
      }}
      onInputChange={(_event, _value, reason) => setSearching(reason === 'input')}
      onChange={(_event, next, reason) => {
        setSearching(false);
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
      value={props.multiple ? currentSelection : (currentSelection[0] ?? null)}
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
