'use client';

import { styled } from '@mui/material/styles';

const Badge = styled('span')(({ theme }) => ({
  position: 'relative',
  backgroundColor: (theme.vars ?? theme).palette.action.hover,
  color: (theme.vars ?? theme).palette.text.secondary,
  borderRadius: 4,
  minWidth: '2.2rem',
  padding: theme.spacing(0.2, 0.6),
  textAlign: 'center',
  flexShrink: 0,
  fontSize: '1.2rem',
}));
const Description = styled('span')({
  position: 'absolute',
  top: 0,
  left: 0,
  width: '0.1rem',
  height: '0.1rem',
  overflow: 'hidden',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
});

export function LoadedTaskCount({ count }: Readonly<{ count: number }>) {
  return (
    <Badge>
      <span aria-hidden="true">{count}</span>
      <Description>
        {count} loaded {count === 1 ? 'task' : 'tasks'}
      </Description>
    </Badge>
  );
}
