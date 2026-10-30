'use client';

import Box from '@mui/material/Box';
import { default as Stack } from '@mui/material/Stack';
import { default as Table } from '@mui/material/Table';
import { default as TableBody } from '@mui/material/TableBody';
import { default as TableCell } from '@mui/material/TableCell';
import { default as TableHead } from '@mui/material/TableHead';
import { default as TableRow } from '@mui/material/TableRow';
import { default as Typography } from '@mui/material/Typography';
import { useState } from 'react';

import { Button } from '../primitives/Button.js';

import type { Grant, Member } from '@flowboard/contracts';

type MemberAccessProps = {
  busy: boolean;
  grants: readonly Grant[];
  members: readonly Member[];
  onEdit: (userId: string) => void;
};

export function MemberAccess({ members, grants, busy, onEdit }: MemberAccessProps) {
  const [page, setPage] = useState(0);

  const lastPage = Math.max(0, Math.ceil(members.length / 20) - 1);
  const current = Math.min(page, lastPage);
  const rows = members.slice(current * 20, (current + 1) * 20);

  return (
    <Stack component="section" aria-label="Container access" spacing={1} sx={{ minWidth: 0 }}>
      <Typography component="h2" variant="h3">
        Member access
      </Typography>
      <Typography>
        A deny blocks this container and descendants. An allow applies only here; every private
        ancestor also needs an allow. Administrators bypass all grants.
      </Typography>
      <Typography>
        Removing a grant restores the container&apos;s public/private policy and ancestor checks.
      </Typography>
      <Box
        role="region"
        aria-label="Scrollable member grants"
        tabIndex={0}
        sx={{ overflowX: 'auto', maxWidth: '100%' }}
      >
        <Table
          aria-label="Workspace member grants"
          size="small"
          sx={{
            minWidth: '60rem',
            '& th, & td': { overflowWrap: 'normal' },
            '& th:nth-of-type(2), & td:nth-of-type(2), & th:nth-of-type(4), & td:nth-of-type(4)': {
              whiteSpace: 'nowrap',
            },
          }}
        >
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Explicit grant</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((member) => (
              <TableRow key={member.userId}>
                <TableCell>
                  {member.name}
                  {member.email && (
                    <Typography color="text.secondary" variant="body2">
                      {member.email}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{member.role}</TableCell>
                <TableCell>
                  {grants.find((grant) => grant.userId === member.userId)?.mode ??
                    'No explicit grant'}
                </TableCell>
                <TableCell>
                  <Button
                    disabled={busy}
                    onClick={() => onEdit(member.userId)}
                    aria-label={`Edit access for ${member.name}${member.email ? ` (${member.email})` : ''}`}
                  >
                    Edit access
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Button disabled={busy || current === 0} onClick={() => setPage(current - 1)}>
          Previous members
        </Button>
        <Typography aria-live="polite">
          Members {members.length ? current * 20 + 1 : 0}–
          {Math.min((current + 1) * 20, members.length)} of {members.length}
        </Typography>
        <Button disabled={busy || current >= lastPage} onClick={() => setPage(current + 1)}>
          Next members
        </Button>
      </Stack>
    </Stack>
  );
}
