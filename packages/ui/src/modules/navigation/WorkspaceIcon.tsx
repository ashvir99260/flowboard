'use client';

import { styled } from '@mui/material/styles';

import type { ReactNode, SVGProps } from 'react';

const glyphs = {
  arrowLeft: <path d="m12 5-7 7 7 7M5 12h14" />,
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  board: (
    <>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="M9 4v16M15 4v16M5.5 8h1M11.5 8h1M17.5 8h1" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z" />,
  home: (
    <>
      <path d="m3 10 9-7 9 7v10H3Z" />
      <path d="M9 20v-7h6v7" />
    </>
  ),
  inbox: (
    <>
      <path d="M5 4h14l2 10v6H3v-6Z" />
      <path d="M3 14h5l2 3h4l2-3h5" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </>
  ),
  logOut: (
    <>
      <path d="M9 5H4v14h5M14 8l4 4-4 4M8 12h10" />
    </>
  ),
  moon: <path d="M20.5 13.3A8.5 8.5 0 0 1 10.7 3.5a8.5 8.5 0 1 0 9.8 9.8Z" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  people: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-4-5.7" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <path d="M20 11a8 8 0 1 0-2.4 6.7M20 4v7h-7" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  settings: (
    <>
      <path d="m9 3-.5 3-2 1.2L4 6l-2 4 2.5 1.8v2.4L2 16l2 4 2.5-1.2L8.5 20l.5 3h6l.5-3 2-1.2L20 20l2-4-2.5-1.8v-2.4L22 10l-2-4-2.5 1.2-2-1.2L15 3Z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 22v-2a8 8 0 0 1 16 0v2" />
    </>
  ),
  space: (
    <>
      <rect height="7" rx="1.5" width="7" x="3" y="3" />
      <rect height="7" rx="1.5" width="7" x="14" y="3" />
      <rect height="7" rx="1.5" width="7" x="3" y="14" />
      <rect height="7" rx="1.5" width="7" x="14" y="14" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type WorkspaceIconName = keyof typeof glyphs;

export type WorkspaceIconProps = Omit<SVGProps<SVGSVGElement>, 'children' | 'viewBox'> & {
  name: WorkspaceIconName;
};

const Icon = styled('svg')({
  display: 'block',
  flexShrink: 0,
  height: '1.6rem',
  width: '1.6rem',
});

export function WorkspaceIcon({ name, ...props }: Readonly<WorkspaceIconProps>) {
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {glyphs[name]}
    </Icon>
  );
}
