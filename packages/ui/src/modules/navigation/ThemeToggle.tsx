'use client';

import IconButton from '@mui/material/IconButton';
import { useColorScheme } from '@mui/material/styles';

import { WorkspaceIcon } from './WorkspaceIcon.js';

export function ThemeToggle() {
  const { mode, systemMode, setMode } = useColorScheme();

  const dark = (mode === 'system' ? systemMode : mode) === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <IconButton
      aria-label={label}
      title={label}
      disabled={!mode}
      onClick={() => setMode(dark ? 'light' : 'dark')}
    >
      <WorkspaceIcon name={dark ? 'sun' : 'moon'} />
    </IconButton>
  );
}
