'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import type { ReactNode } from 'react';

export function EmptyState({
  action,
  description,
  title,
}: Readonly<{ action?: ReactNode; description: string; title: string }>) {
  return (
    <Box
      role="status"
      aria-label={title}
      sx={{
        p: 3,
        bgcolor: 'background.paper',
        border: '1px dashed',
        borderColor: 'divider',
        borderRadius: 1,
      }}
    >
      <Typography component="p" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {description}
      </Typography>
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
