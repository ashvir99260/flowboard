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
        secondary: {
          main: designTokens.palette.light.selected,
          contrastText: designTokens.palette.light.foreground,
        },
        error: {
          main: designTokens.palette.light.error,
          contrastText: designTokens.palette.light.onAccent,
        },
        warning: {
          main: designTokens.palette.light.warning,
          contrastText: designTokens.palette.light.onAccent,
        },
        success: {
          main: designTokens.palette.light.success,
          contrastText: designTokens.palette.light.onAccent,
        },
        info: {
          main: designTokens.palette.light.info,
          contrastText: designTokens.palette.light.onAccent,
        },
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
        secondary: {
          main: designTokens.palette.dark.selected,
          contrastText: designTokens.palette.dark.foreground,
        },
        error: {
          main: designTokens.palette.dark.error,
          contrastText: designTokens.palette.dark.onAccent,
        },
        warning: {
          main: designTokens.palette.dark.warning,
          contrastText: designTokens.palette.dark.onAccent,
        },
        success: {
          main: designTokens.palette.dark.success,
          contrastText: designTokens.palette.dark.onAccent,
        },
        info: {
          main: designTokens.palette.dark.info,
          contrastText: designTokens.palette.dark.onAccent,
        },
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
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiFormControl: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiSelect: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 0, marginRight: 0 } } },
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
      styleOverrides: {
        root: ({ ownerState }) => ({
          minHeight: designTokens.controlHeight,
          fontSize: '1.4rem',
          ...(ownerState.multiline ? { padding: '0.7rem 1.2rem' } : {}),
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: '1px' },
          '@media (pointer: coarse)': { minHeight: designTokens.touchControlHeight },
        }),
        input: ({ ownerState }) => ({
          lineHeight: '2rem',
          ...(ownerState.multiline ? { padding: 0 } : { height: '2rem', padding: '0.7rem 1.2rem' }),
        }),
        notchedOutline: ({ theme }) => ({
          borderColor: designTokens.palette.light.inputBorder,
          ...theme.applyStyles('dark', { borderColor: designTokens.palette.dark.inputBorder }),
        }),
      },
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
      styleOverrides: {
        root: {
          fontWeight: 500,
          minHeight: designTokens.controlHeight,
          '@media (pointer: coarse)': { minHeight: designTokens.touchControlHeight },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minHeight: designTokens.controlHeight,
          minWidth: designTokens.controlHeight,
          '@media (pointer: coarse)': {
            minHeight: designTokens.touchControlHeight,
            minWidth: designTokens.touchControlHeight,
          },
        },
      },
    },
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
