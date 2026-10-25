'use client';

import { styled } from '@mui/material/styles';
import { default as Typography } from '@mui/material/Typography';

import type { ReactNode } from 'react';

const Root = styled('div', { name: 'FlowboardEmptyState', slot: 'Root' })(({ theme }) => ({
  padding: theme.spacing(1.2),
  backgroundColor: (theme.vars ?? theme).palette.background.paper,
  border: `1px dashed ${(theme.vars ?? theme).palette.divider}`,
  borderRadius: theme.shape.borderRadius,
}));
const Title = styled(Typography)({ fontWeight: 600 }) as typeof Typography;
const Description = styled(Typography)(({ theme }) => ({ marginTop: theme.spacing(0.4) }));
const Action = styled('div')(({ theme }) => ({ marginTop: theme.spacing(0.8) }));

export function EmptyState({
  action,
  description,
  title,
}: Readonly<{ action?: ReactNode; description: string; title: string }>) {
  return (
    <Root role="status" aria-label={title}>
      <Title component="p">{title}</Title>
      <Description color="text.secondary" variant="body2">
        {description}
      </Description>
      {action && <Action>{action}</Action>}
    </Root>
  );
}
