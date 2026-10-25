'use client';
import MuiNativeSelect from '@mui/material/NativeSelect';
import { styled } from '@mui/material/styles';

import { designTokens } from '../theme/tokens.js';

const SelectRoot = styled(MuiNativeSelect, { name: 'FlowboardSelect', slot: 'Root' })(
  ({ theme }) => ({
    minHeight: designTokens.controlHeight,
    fontSize: '1.4rem',
    border: `1px solid ${designTokens.palette.light.inputBorder}`,
    ...theme.applyStyles('dark', { borderColor: designTokens.palette.dark.inputBorder }),
    borderRadius: theme.shape.borderRadius,
    backgroundColor: (theme.vars ?? theme).palette.background.paper,
    '&::before, &::after': { display: 'none' },
    '& select': { padding: theme.spacing(0.7, 3.2, 0.7, 1.2), lineHeight: '2rem' },
    '& select:not([multiple])': { height: '2rem' },
    '& select[multiple]': { minHeight: '9.6rem' },
    '@media (pointer: coarse)': { minHeight: designTokens.touchControlHeight },
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
