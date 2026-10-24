'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        background: { default: '#F7F8FA', paper: '#FFFFFF' },
        text: { primary: '#17202E', secondary: '#4D5B6F' },
        primary: { contrastText: '#FFFFFF', main: '#245CC5' },
        error: { main: '#B42318' },
        warning: { main: '#8A4600' },
        success: { main: '#146C43' },
        divider: '#D9DEE7',
        action: { selected: '#EAF1FF' },
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        background: { default: '#10151D', paper: '#18202B' },
        text: { primary: '#E7EDF6', secondary: '#A9B6C8' },
        primary: { contrastText: '#10151D', main: '#8AB4FF' },
        error: { main: '#FFB4AB' },
        warning: { main: '#F0BA72' },
        success: { main: '#79DBA4' },
        divider: '#354255',
        action: { selected: '#263D60' },
      },
    },
  },
  typography: {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
    h1: { fontSize: '1.375rem', fontWeight: 650, lineHeight: 1.45 },
    h2: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.5 },
    h3: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: '0.875rem', lineHeight: 1.5 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    button: { fontSize: '0.875rem', textTransform: 'none' },
  },
  spacing: 4,
  shape: { borderRadius: 6 },
  components: {
    MuiButtonBase: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: {
          '&.Mui-focusVisible': {
            outline: '2px solid var(--mui-palette-primary-main)',
            outlineOffset: 3,
          },
        },
      },
    },
    MuiButton: { styleOverrides: { root: { fontWeight: 600, minHeight: 44 } } },
    MuiIconButton: { styleOverrides: { root: { minHeight: 44, minWidth: 44 } } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCssBaseline: {
      styleOverrides: {
        body: { overflowWrap: 'anywhere' },
        ':focus-visible': {
          outline: '2px solid var(--mui-palette-primary-main)',
          outlineOffset: 3,
        },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
  },
});
