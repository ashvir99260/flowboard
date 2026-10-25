'use client';

import type { WorkspaceRole } from '@flowboard/contracts';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Stack,
  WorkspaceIcon,
} from '@flowboard/ui';
import NextLink from 'next/link';
import { useId, useState } from 'react';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import { useTaskEditor } from '../tasks/useTaskEditor';
import { InviteMembers } from './InviteMembers';
import { TaskDestination } from './TaskDestination';

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
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [chooseList, setChooseList] = useState(false);
  const menuId = useId();
  const pickerId = useId();
  const admin = role === 'admin';
  const base = `/w/${scope.workspaceId}`;

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
            <Button
              aria-label="Settings"
              title="Settings"
              sx={{
                minWidth: { xs: '3.6rem', sm: 'auto' },
                gap: 0.6,
                px: { xs: 0.8, sm: 1.2 },
                '@media (pointer: coarse)': { minWidth: '4.4rem' },
              }}
              aria-controls={menuAnchor ? menuId : undefined}
              aria-haspopup="menu"
              aria-expanded={menuAnchor ? 'true' : undefined}
              onClick={(event) => setMenuAnchor(event.currentTarget)}
            >
              <WorkspaceIcon name="settings" />
              <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                Settings
              </Box>
            </Button>
            <Menu
              id={menuId}
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              <MenuItem
                component={NextLink}
                href={`${base}/settings/workspace`}
                onClick={() => setMenuAnchor(null)}
              >
                Workspace settings
              </MenuItem>
              <MenuItem
                component={NextLink}
                href={`${base}/settings/administration`}
                onClick={() => setMenuAnchor(null)}
              >
                Add or manage lists
              </MenuItem>
              <MenuItem
                component={NextLink}
                href={`${base}/settings/fields`}
                onClick={() => setMenuAnchor(null)}
              >
                Custom fields
              </MenuItem>
              <MenuItem
                component={NextLink}
                href={`${base}/settings/administration`}
                onClick={() => setMenuAnchor(null)}
              >
                Members and access
              </MenuItem>
            </Menu>
          </>
        )}
      </Stack>
      {admin && (
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
