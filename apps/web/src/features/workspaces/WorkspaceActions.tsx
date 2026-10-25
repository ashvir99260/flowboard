'use client';

import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  ThemeToggle,
  WorkspaceIcon,
} from '@flowboard/ui';
import { useId, useState } from 'react';

import { useTaskEditor } from '../tasks/useTaskEditor';

import { InviteMembers } from './InviteMembers';
import { TaskDestination } from './TaskDestination';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { WorkspaceRole } from '@flowboard/contracts';

export function WorkspaceActions({
  listId,
  runtime,
  scope,
  role,
}: {
  listId?: string;
  role: WorkspaceRole;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const openTask = useTaskEditor();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chooseList, setChooseList] = useState(false);
  const pickerId = useId();

  const admin = role === 'admin';

  return (
    <>
      <Stack
        component="nav"
        aria-label="Workspace actions"
        direction="row"
        spacing={{ xs: 0.4, sm: 0.8 }}
        sx={{ alignItems: 'center', flexWrap: 'nowrap' }}
      >
        <Button
          variant="contained"
          sx={{ whiteSpace: 'nowrap', minWidth: 'auto', px: { xs: 0.8, sm: 1.2 } }}
          onClick={() => (listId ? openTask(null) : setChooseList(true))}
        >
          New task
        </Button>
        {admin && (
          <>
            <Button
              aria-label="Invite"
              title="Invite"
              variant="outlined"
              sx={{
                minWidth: { xs: '3.6rem', sm: 'auto' },
                gap: 0.6,
                px: { xs: 0.8, sm: 1.2 },
                '@media (pointer: coarse)': { minWidth: '4.4rem' },
              }}
              onClick={() => setInviteOpen(true)}
            >
              <WorkspaceIcon name="people" />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Invite
              </Box>
            </Button>
          </>
        )}
        <ThemeToggle />
      </Stack>
      {admin && inviteOpen && (
        <InviteMembers
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          runtime={runtime}
          scope={scope}
        />
      )}
      <Dialog
        open={chooseList}
        fullWidth
        maxWidth="sm"
        aria-labelledby={pickerId}
        onClose={() => setChooseList(false)}
      >
        <DialogTitle id={pickerId}>Create a task</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2}>
            {chooseList && (
              <TaskDestination
                runtime={runtime}
                scope={scope}
                onSelect={(id) => {
                  setChooseList(false);
                  requestAnimationFrame(() => openTask(null, id));
                }}
              />
            )}
            <Button onClick={() => setChooseList(false)}>Cancel</Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
