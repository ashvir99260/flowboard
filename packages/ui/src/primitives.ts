'use client';

import MuiButton from '@mui/material/Button';
import MuiChip from '@mui/material/Chip';
import MuiPaper from '@mui/material/Paper';
import { styled } from '@mui/material/styles';
import MuiTextField from '@mui/material/TextField';

import { designTokens } from './tokens.js';

// Keep MUI's polymorphic public signatures, including component-specific refs.
export const Button = styled(MuiButton, { name: 'FlowboardButton', slot: 'Root' })(({ theme }) => ({
  minHeight: designTokens.controlHeight,
  borderRadius: theme.shape.borderRadius,
  boxShadow: 'none',
  fontWeight: 500,
  '&:hover': { boxShadow: 'none' },
})) as typeof MuiButton;

export const Chip = styled(MuiChip, { name: 'FlowboardChip', slot: 'Root' })(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  fontWeight: 500,
  maxWidth: '100%',
})) as typeof MuiChip;

export const Paper = styled(MuiPaper, { name: 'FlowboardPaper', slot: 'Root' })({
  backgroundImage: 'none',
  borderRadius: designTokens.radius.surface,
}) as typeof MuiPaper;

export const TextField = styled(MuiTextField, { name: 'FlowboardTextField', slot: 'Root' })({
  minWidth: 0,
}) as typeof MuiTextField;

export { default as Alert } from '@mui/material/Alert';

export { default as Box } from '@mui/material/Box';

export { default as Checkbox } from '@mui/material/Checkbox';

export { default as CircularProgress } from '@mui/material/CircularProgress';

export { default as Dialog } from '@mui/material/Dialog';

export { default as DialogActions } from '@mui/material/DialogActions';

export { default as DialogContent } from '@mui/material/DialogContent';

export { default as DialogTitle } from '@mui/material/DialogTitle';

export { default as Divider } from '@mui/material/Divider';

export { default as Drawer } from '@mui/material/Drawer';

export { default as FormControl } from '@mui/material/FormControl';

export { default as FormControlLabel } from '@mui/material/FormControlLabel';

export { default as FormHelperText } from '@mui/material/FormHelperText';

export { default as InputLabel } from '@mui/material/InputLabel';

export { default as Link } from '@mui/material/Link';

export { default as NativeSelect } from '@mui/material/NativeSelect';

export { default as Stack } from '@mui/material/Stack';

export { default as Table } from '@mui/material/Table';

export { default as TableBody } from '@mui/material/TableBody';

export { default as TableCell } from '@mui/material/TableCell';

export { default as TableContainer } from '@mui/material/TableContainer';

export { default as TableHead } from '@mui/material/TableHead';

export { default as TableRow } from '@mui/material/TableRow';

export { default as ToggleButton } from '@mui/material/ToggleButton';

export { default as ToggleButtonGroup } from '@mui/material/ToggleButtonGroup';

export { default as Typography } from '@mui/material/Typography';

export { default as useMediaQuery } from '@mui/material/useMediaQuery';
