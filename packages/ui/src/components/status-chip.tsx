'use client';

import { styled } from '@mui/material/styles';

import { toHslColor } from '../color.js';
import { Chip } from '../primitives.js';

import type { ResolvedStatus, StatusCategory } from '@flowboard/contracts';

const Dot = styled('span', { name: 'FlowboardStatus', slot: 'Dot' })(({ theme }) => ({
  border: `1px solid ${(theme.vars ?? theme).palette.text.secondary}`,
  borderRadius: '999px',
  height: '0.8rem',
  width: '0.8rem',
}));

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
      icon={<Dot aria-hidden="true" style={{ backgroundColor: toHslColor(status.color) }} />}
      label={label}
      size="small"
      title={label}
      variant="outlined"
    />
  );
}
