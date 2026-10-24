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
        error: { main: 'hsl(4.2308, 76.4706%, 40%)' },
        warning: { main: 'hsl(30.4348, 100%, 27.0588%)' },
        success: { main: 'hsl(152.0455, 68.75%, 25.098%)' },
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
        error: { main: 'hsl(6.4286, 100%, 83.5294%)' },
        warning: { main: 'hsl(34.2857, 80.7692%, 69.4118%)' },
        success: { main: 'hsl(146.3265, 57.6471%, 66.6667%)' },
        divider: designTokens.palette.dark.border,
        action: { selected: designTokens.palette.dark.selected },
      },
    },
  },
  breakpoints: {
    unit: 'rem',
    values: { lg: 75, md: 56.25, sm: 37.5, xl: 96, xs: 0 },
    step: 0.3125,
  },
  typography: {
    htmlFontSize: 10,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
    h1: { fontSize: '2.2rem', fontWeight: 650, lineHeight: 1.45 },
    h2: { fontSize: '1.8rem', fontWeight: 600, lineHeight: 1.5 },
    h3: { fontSize: '1.6rem', fontWeight: 600, lineHeight: 1.5 },
    body1: { fontSize: '1.4rem', lineHeight: 1.5 },
    body2: { fontSize: '1.3rem', lineHeight: 1.5 },
    button: { fontSize: '1.4rem', textTransform: 'none' },
  },
  spacing: (factor: number | 'auto') =>
    factor === 'auto' ? factor : `${factor * designTokens.spacing}rem`,
  shape: { borderRadius: designTokens.radius.control },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: ({ ownerState }) => {
          if (ownerState.fullScreen) return {};

          const widths = { lg: '120rem', md: '90rem', sm: '60rem', xl: '153.6rem', xs: '44.4rem' };
          const available = 'calc(100% - 6.4rem)';
          const maxWidth = ownerState.maxWidth
            ? `min(${widths[ownerState.maxWidth]}, ${available})`
            : available;

          return {
            margin: '3.2rem',
            maxWidth,
            ...(ownerState.fullWidth ? { width: available } : {}),
            ...(ownerState.scroll === 'paper' ? { maxHeight: available } : {}),
            '&.MuiDialog-paperScrollBody': { maxWidth },
          };
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontSize: '1.3rem',
          fontWeight: 500,
          marginBottom: '0.6rem',
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
            outlineOffset: '0.3rem',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: { root: { fontWeight: 500, minHeight: designTokens.controlHeight } },
    },
    MuiIconButton: { styleOverrides: { root: { minHeight: '4.4rem', minWidth: '4.4rem' } } },
    MuiPaper: { defaultProps: { elevation: 0 } },
    MuiCssBaseline: {
      styleOverrides: {
        html: { fontSize: '62.5%' },
        body: { overflowWrap: 'anywhere' },
        ':focus-visible': {
          outline: '2px solid var(--mui-palette-primary-main)',
          outlineOffset: '0.3rem',
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
