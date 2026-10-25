'use client';

import { TaskDueDateSchema } from '@flowboard/contracts';
import Typography from '@mui/material/Typography';

import { formatTimestamp } from '../../utils/formatDate.js';

import type { Task } from '@flowboard/contracts';

const calendar = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export function DueDateLabel({
  date,
  overdue = false,
  variant = 'full',
}: Readonly<{ date: Task['dueDate']; overdue?: boolean; variant?: 'full' | 'compact' }>) {
  if (date === null)
    return (
      <Typography color="text.secondary" component="span" variant="body2">
        No due date
      </Typography>
    );

  const parsed = TaskDueDateSchema.safeParse(date);
  if (!parsed.success)
    return (
      <Typography color="error" component="span" variant="body2">
        Invalid date
      </Typography>
    );

  const fullLabel = `${overdue ? 'Overdue' : 'Due'} · ${formatTimestamp(parsed.data)}`;
  const compact = variant === 'compact';

  return (
    <Typography
      aria-label={compact ? fullLabel : undefined}
      component="time"
      dateTime={date}
      color={overdue ? 'error' : 'text.secondary'}
      title={compact ? fullLabel : undefined}
      variant="body2"
    >
      {compact
        ? `${overdue ? 'Overdue · ' : ''}${calendar.format(new Date(parsed.data))}`
        : fullLabel}
    </Typography>
  );
}
