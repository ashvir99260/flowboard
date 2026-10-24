'use client';

import { Chip } from '../../primitives.js';
import { colorFill } from '../../utils/color.js';

import type { ResolvedStatus, StatusCategory } from '@flowboard/contracts';

const categories: Record<StatusCategory, string> = {
  not_started: 'Not started',
  active: 'Active',
  done: 'Done',
  closed: 'Closed',
};

export function StatusChip({
  status,
}: Readonly<{ status: Pick<ResolvedStatus, 'category' | 'color' | 'name'> }>) {
  const label = `${status.name} · ${categories[status.category]}`;

  return (
    <Chip
      label={label}
      size="small"
      title={label}
      variant="filled"
      style={colorFill(status.color)}
    />
  );
}
