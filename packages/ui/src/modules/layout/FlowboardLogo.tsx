'use client';

import { styled } from '@mui/material/styles';

import type { HTMLAttributes } from 'react';

export type FlowboardLogoProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'> & {
  label?: string;
};

const Brand = styled('span')(({ theme }) => ({
  alignItems: 'center',
  color: (theme.vars ?? theme).palette.text.primary,
  display: 'inline-flex',
  flexShrink: 0,
  fontSize: '1.8rem',
  fontWeight: 750,
  gap: theme.spacing(0.8),
  letterSpacing: '-0.05rem',
  lineHeight: 1,
  whiteSpace: 'nowrap',
}));
const Mark = styled('svg')(({ theme }) => ({
  backgroundColor: (theme.vars ?? theme).palette.primary.main,
  borderRadius: 8,
  color: (theme.vars ?? theme).palette.primary.contrastText,
  height: '2.8rem',
  width: '2.8rem',
}));
const Wordmark = styled('span')(({ theme }) => ({
  [theme.breakpoints.down('sm')]: { display: 'none' },
}));

export function FlowboardLogo({ label = 'Flowboard', ...props }: Readonly<FlowboardLogoProps>) {
  return (
    <Brand role="img" aria-label={label} {...props}>
      <Mark aria-hidden="true" fill="none" viewBox="0 0 32 32">
        <path
          d="M8 10h11a5 5 0 0 1 0 10h-6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="3"
        />
        <path d="M8 16h7M8 22h3" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </Mark>
      <Wordmark aria-hidden="true">{label}</Wordmark>
    </Brand>
  );
}
