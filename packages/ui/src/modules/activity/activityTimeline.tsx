'use client';
import { styled } from '@mui/material/styles';

import { Typography } from '../../primitives.js';
import { formatTimestamp } from '../../utils/formatDate.js';

import type { Activity, ResolvedStatus } from '@flowboard/contracts';

const Entries = styled('ol')(({ theme }) => ({
  margin: 0,
  paddingLeft: theme.spacing(1),
  '& li + li': { marginTop: theme.spacing(0.8) },
}));
const Entry = styled('li')({ overflowWrap: 'anywhere' });

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
            {formatTimestamp(item.payload.occurredAt)}
          </Typography>
        </Entry>
      ))}
    </Entries>
  );
}
