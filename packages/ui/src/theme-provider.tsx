'use client';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';

import { theme } from './theme.js';

import type { ReactNode } from 'react';

export function ThemeProvider({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <AppRouterCacheProvider options={{ key: 'flowboard' }}>
      <MuiThemeProvider
        theme={theme}
        defaultMode="light"
        storageManager={null}
        disableTransitionOnChange
      >
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </AppRouterCacheProvider>
  );
}
