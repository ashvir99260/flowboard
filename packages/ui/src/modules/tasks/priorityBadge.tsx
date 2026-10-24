'use client';

import { Chip } from '../../primitives.js';

import type { Priority } from '@flowboard/contracts';

const priorities = {
  urgent: { label: 'Urgent', color: 'error' },
  high: { label: 'High', color: 'warning' },
  normal: { label: 'Normal', color: 'info' },
  low: { label: 'Low', color: 'success' },
  none: { label: 'No priority', color: 'default' },
} as const;

export function PriorityBadge({ priority }: Readonly<{ priority: Priority }>) {
  const { color, label } = priorities[priority];

  return <Chip color={color} label={label} size="small" variant="filled" />;
}
