'use client';

import { createTheme } from '@mui/material/styles';

import { designTokens } from './tokens.js';

export const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        mode: 'light',
        background: {
          default: designTokens.palette.light.background,
          paper: designTokens.palette.light.surface,
        },
        text: {
          primary: designTokens.palette.light.foreground,
          secondary: designTokens.palette.light.muted,
        },
        primary: {
          contrastText: designTokens.palette.light.surface,
          main: designTokens.palette.light.foreground,
        },
        error: { main: '#B42318' },
        warning: { main: '#8A4600' },
        success: { main: '#146C43' },
        divider: designTokens.palette.light.border,
        action: { selected: designTokens.palette.light.selected },
      },
    },
    dark: {
      palette: {
        mode: 'dark',
        background: {
          default: designTokens.palette.dark.background,
          paper: designTokens.palette.dark.surface,
        },
        text: {
          primary: designTokens.palette.dark.foreground,
          secondary: designTokens.palette.dark.muted,
        },
        primary: {
          contrastText: designTokens.palette.dark.background,
          main: designTokens.palette.dark.foreground,
        },
        error: { main: '#FFB4AB' },
        warning: { main: '#F0BA72' },
        success: { main: '#79DBA4' },
        divider: designTokens.palette.dark.border,
        action: { selected: designTokens.palette.dark.selected },
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
  spacing: designTokens.spacing,
  shape: { borderRadius: designTokens.radius.control },
  components: {
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '0.8125rem',
          fontWeight: 500,
          marginBottom: 6,
          pointerEvents: 'auto',
          position: 'static',
          transform: 'none',
        },
      },
    },
    MuiOutlinedInput: {
      defaultProps: { notched: false },
      styleOverrides: { notchedOutline: { borderColor: 'var(--mui-palette-text-secondary)' } },
    },
    MuiInput: {
      styleOverrides: {
        root: {
          '&::before': { borderBottomColor: 'var(--mui-palette-text-secondary)' },
          'label + &, .MuiInputLabel-root + &': { marginTop: 0 },
        },
      },
    },
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
    MuiButton: {
      styleOverrides: { root: { fontWeight: 500, minHeight: designTokens.controlHeight } },
    },
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
