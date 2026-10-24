'use client';

import { styled } from '@mui/material/styles';
import { useId } from 'react';

import { Toolbar } from '../composition.js';
import { Stack, Typography } from '../primitives.js';

import type { Activity, ResolvedStatus } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const Entries = styled('ol')(({ theme }) => ({
  margin: 0,
  paddingLeft: theme.spacing(2.5),
  '& li + li': { marginTop: theme.spacing(2) },
}));
const Entry = styled('li')({ overflowWrap: 'anywhere' });

export function ActivityPanel({
  actions,
  children,
}: Readonly<{ actions?: ReactNode; children: ReactNode }>) {
  const id = useId();

  return (
    <Stack component="section" aria-labelledby={id} spacing={2}>
      <Toolbar.Root>
        <Typography component="h3" variant="h3" id={id}>
          Activity
        </Typography>
        {actions}
      </Toolbar.Root>
      {children}
    </Stack>
  );
}

export function ActivityTimeline({
  items,
  statuses,
}: Readonly<{ items: readonly Activity[]; statuses: readonly ResolvedStatus[] }>) {
  const label = (id: string) =>
    statuses.find((status) => status.id === id)?.name ?? `Status ${id.slice(0, 8)}`;

  return (
    <Entries>
      {items.map((item) => (
        <Entry key={item.id}>
          <Typography>
            {item.actor.name} changed status from{' '}
            <strong>{label(item.payload.beforeStatusId)}</strong> to{' '}
            <strong>{label(item.payload.afterStatusId)}</strong>.
          </Typography>
          <Typography
            component="time"
            dateTime={item.payload.occurredAt}
            variant="caption"
            color="text.secondary"
          >
            {new Date(item.payload.occurredAt).toLocaleString()}
          </Typography>
        </Entry>
      ))}
    </Entries>
  );
}
