'use client';

import { styled } from '@mui/material/styles';
import Markdown from 'react-markdown';

const Content = styled('section', { name: 'FlowboardMarkdown', slot: 'Root' })(({ theme }) => ({
  overflowWrap: 'anywhere',
  '& pre': {
    overflowX: 'auto',
    backgroundColor: (theme.vars ?? theme).palette.action.hover,
    padding: theme.spacing(2),
  },
  '& a': { color: (theme.vars ?? theme).palette.primary.main },
  '& img': { maxWidth: '100%' },
  '& blockquote': {
    borderLeft: `3px solid ${(theme.vars ?? theme).palette.divider}`,
    paddingLeft: theme.spacing(2),
    marginLeft: 0,
  },
}));

export function MarkdownContent({
  children,
  label = 'Description preview',
}: Readonly<{ children: string; label?: string }>) {
  return (
    <Content aria-label={label}>
      <Markdown skipHtml>{children}</Markdown>
    </Content>
  );
}
