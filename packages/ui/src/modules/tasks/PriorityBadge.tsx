'use client';

import { Chip } from '../primitives/Chip.js';

import type { Priority } from '@flowboard/contracts';

const priorities = {
  urgent: { label: 'Urgent', color: 'error' },
  high: { label: 'High', color: 'warning' },
  normal: { label: 'Normal', color: 'info' },
  low: { label: 'Low', color: 'success' },
  none: { label: 'No priority', color: 'default' },
} as const;

type PriorityBadgeProps = Readonly<{ priority: Priority }>;

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const { color, label } = priorities[priority];

  return <Chip color={color} label={label} size="small" variant="filled" />;
}
