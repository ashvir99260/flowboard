'use client';

import Avatar from '@mui/material/Avatar';
import AvatarGroup from '@mui/material/AvatarGroup';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { Task } from '@flowboard/contracts';

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
      <AvatarGroup
        max={4}
        aria-hidden="true"
        slotProps={{ surplus: { sx: { bgcolor: 'action.selected', color: 'text.primary' } } }}
        sx={{
          justifyContent: 'flex-end',
          '& .MuiAvatar-root': { width: 28, height: 28, fontSize: 12 },
        }}
      >
        {assignees.map(({ id, name }) => (
          <Avatar
            key={id}
            title={name}
            sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}
          >
            {initials(name)}
          </Avatar>
        ))}
      </AvatarGroup>
    </Box>
  );
}
