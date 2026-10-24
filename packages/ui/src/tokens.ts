export const designTokens = {
  controlHeight: '4.4rem',
  radius: { control: 6, surface: 8 },
  spacing: 1,
  palette: {
    light: {
      background: 'hsl(0, 0%, 98.0392%)',
      border: 'hsl(240, 5.8824%, 90%)',
      foreground: 'hsl(240, 5.8824%, 10%)',
      inputBorder: 'hsl(240, 3.8298%, 46.0784%)',
      muted: 'hsl(240, 5.2023%, 33.9216%)',
      selected: 'hsl(240, 5.8824%, 90%)',
      surface: 'hsl(0, 0%, 100%)',
    },
    dark: {
      background: 'hsl(240, 10%, 3.9216%)',
      border: 'hsl(240, 5.2632%, 26.0784%)',
      foreground: 'hsl(0, 0%, 98.0392%)',
      inputBorder: 'hsl(240, 5.0279%, 64.902%)',
      muted: 'hsl(240, 5.0279%, 64.902%)',
      selected: 'hsl(240, 3.7037%, 15.8824%)',
      surface: 'hsl(240, 5.8824%, 10%)',
    },
  },
} as const;
