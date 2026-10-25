'use client';

import { TaskDueDateSchema } from '@flowboard/contracts';
import Typography from '@mui/material/Typography';

import { formatTimestamp } from '../../utils/formatDate.js';

import type { Task } from '@flowboard/contracts';

export function DueDateLabel({
  date,
  overdue = false,
}: Readonly<{ date: Task['dueDate']; overdue?: boolean }>) {
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

  return (
    <Typography
      component="time"
      dateTime={date}
      color={overdue ? 'error' : 'text.secondary'}
      variant="body2"
    >
      {overdue ? 'Overdue' : 'Due'} · {formatTimestamp(parsed.data)}
    </Typography>
  );
}
