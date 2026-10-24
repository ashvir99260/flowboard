import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, useColorScheme } from '@mui/material/styles';
import { useEffect } from 'react';

import { theme } from '../src/theme.js';

import type { Preview } from '@storybook/react-vite';
import type { ReactNode } from 'react';

function Mode({ mode }: { mode: 'light' | 'dark' }) {
  const { setMode } = useColorScheme();
  useEffect(() => setMode(mode), [mode, setMode]);

  return null;
}

function Canvas({ children, mode }: { children: ReactNode; mode: 'light' | 'dark' }) {
  return (
    <ThemeProvider
      theme={theme}
      defaultMode="light"
      storageManager={null}
      disableTransitionOnChange
    >
      <Mode mode={mode} />
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

const preview: Preview = {
  decorators: [
    (Story, context) => (
      <Canvas mode={context.globals.theme === 'dark' ? 'dark' : 'light'}>
        <Story />
      </Canvas>
    ),
  ],
  globalTypes: {
    theme: {
      description: 'Flowboard color scheme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: ['light', 'dark'],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
    controls: { expanded: true },
    viewport: {
      options: {
        mobile: { name: 'Mobile · 320', styles: { width: '320px', height: '720px' } },
        tablet: { name: 'Tablet · 768', styles: { width: '768px', height: '1024px' } },
        laptop: { name: 'Laptop · 1024', styles: { width: '1024px', height: '768px' } },
        desktop: { name: 'Desktop · 1440', styles: { width: '1440px', height: '900px' } },
      },
    },
  },
  tags: ['autodocs'],
};

export default preview;
