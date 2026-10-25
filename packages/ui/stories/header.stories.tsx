import Stack from '@mui/material/Stack';

import { AccountMenu } from '../src/modules/navigation/AccountMenu.js';
import { HeaderSearchButton } from '../src/modules/navigation/HeaderSearchButton.js';
import { ThemeToggle } from '../src/modules/navigation/ThemeToggle.js';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Navigation/Header controls',
  component: AccountMenu,
  args: { name: 'Alice Morgan', role: 'admin', onSignOut: () => undefined },
} satisfies Meta<typeof AccountMenu>;

export default meta;

export const Account: StoryObj<typeof meta> = {};

export const SearchAndTheme: StoryObj<typeof meta> = {
  render: () => (
    <Stack direction="row" spacing={1} sx={{ width: '50rem', maxWidth: '100%' }}>
      <HeaderSearchButton onClick={() => undefined} />
      <ThemeToggle />
    </Stack>
  ),
};
