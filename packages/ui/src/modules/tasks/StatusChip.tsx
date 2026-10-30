'use client';

import { colorFill } from '../../utils/color.js';
import { Chip } from '../primitives/Chip.js';

import type { ResolvedStatus, StatusCategory } from '@flowboard/contracts';

const categories: Record<StatusCategory, string> = {
  not_started: 'Not started',
  active: 'Active',
  done: 'Done',
  closed: 'Closed',
};

type StatusChipProps = Readonly<{ status: Pick<ResolvedStatus, 'category' | 'color' | 'name'> }>;

export function StatusChip({ status }: StatusChipProps) {
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
