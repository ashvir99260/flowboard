'use client';

import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import type { Task } from '@flowboard/contracts';

const Group = styled(AvatarGroup)({
  justifyContent: 'flex-end',
  '& .MuiAvatar-root': { width: '2.8rem', height: '2.8rem', fontSize: '1.2rem' },
});
const Person = styled(Avatar)(({ theme }) => ({
  backgroundColor: (theme.vars ?? theme).palette.primary.main,
  color: (theme.vars ?? theme).palette.primary.contrastText,
}));

function initials(name: string): string {
  const parts = name.trim().split(/\s+/u);
  const first = Array.from(parts[0] ?? '')[0] ?? '';
  const last = parts.length > 1 ? (Array.from(parts.at(-1) ?? '')[0] ?? '') : '';

  return `${first}${last}`.toLocaleUpperCase('en-US');
}

export function AssigneeAvatarGroup({
  assignees,
}: Readonly<{ assignees: ReadonlyArray<Task['assignees'][number]> }>) {
  if (!assignees.length)
    return (
      <Typography color="text.secondary" component="span" variant="body2">
        Unassigned
      </Typography>
    );

  return (
    <Box role="img" aria-label={`Assignees: ${assignees.map(({ name }) => name).join(', ')}`}>
      <Group
        max={4}
        aria-hidden="true"
        slotProps={{ surplus: { sx: { bgcolor: 'action.selected', color: 'text.primary' } } }}
      >
        {assignees.map(({ id, name }) => (
          <Person key={id} title={name}>
            {initials(name)}
          </Person>
        ))}
      </Group>
    </Box>
  );
}
