'use client';
import MuiNativeSelect from '@mui/material/NativeSelect';
import { styled } from '@mui/material/styles';

const SelectRoot = styled(MuiNativeSelect, { name: 'FlowboardSelect', slot: 'Root' })(
  ({ theme }) => ({
    minHeight: '4.4rem',
    border: `1px solid ${(theme.vars ?? theme).palette.text.secondary}`,
    borderRadius: theme.shape.borderRadius,
    backgroundColor: (theme.vars ?? theme).palette.background.paper,
    '&::before, &::after': { display: 'none' },
    '& select': { padding: theme.spacing(0.8, 3.2, 0.8, 1.2) },
    '&.Mui-error': { borderColor: (theme.vars ?? theme).palette.error.main },
    '&:focus-within': {
      outline: `2px solid ${(theme.vars ?? theme).palette.primary.main}`,
      outlineOffset: '0.2rem',
    },
  }),
);

export const NativeSelect = Object.assign(SelectRoot, {
  muiName: MuiNativeSelect.muiName,
}) as typeof MuiNativeSelect;
