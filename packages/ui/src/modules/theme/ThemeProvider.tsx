'use client';

import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';

import { theme } from './theme.js';

import type { ReactNode } from 'react';

type ThemeProviderProps = Readonly<{ children: ReactNode }>;

export function ThemeProvider({ children }: ThemeProviderProps) {
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
