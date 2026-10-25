'use client';

import { NodeSchema } from '@flowboard/contracts';
import { FormFields, useZodForm } from '@flowboard/forms';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  EmptyState,
  Menu,
  MenuItem,
  Stack,
  Typography,
  WorkspaceIcon,
} from '@flowboard/ui';
import NextLink from 'next/link';
import { useId, useState } from 'react';
import { z } from 'zod';

import { useTaskEditor } from '../tasks/task-drawer';
import { useTree } from '../tree/use-tree';

import { InviteMembers } from './invite-members';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { WorkspaceRole } from '@flowboard/contracts';

type ContainerNode = ReturnType<typeof NodeSchema.parse>;

const DestinationSchema = z.strictObject({ listId: NodeSchema.shape.id });

function DestinationForm({
  nodes,
  onSelect,
}: {
  nodes: readonly ContainerNode[];
  onSelect: (listId: string) => void;
}) {
  const lists = nodes.filter(({ type }) => type === 'list');
  const { control, handleSubmit } = useZodForm(DestinationSchema, {
    defaultValues: { listId: lists[0]?.id ?? '' },
  });
  const label = (node: ContainerNode) => {
    const parent = nodes.find(({ id }) => id === node.parentId);
    const space = nodes.find(({ id }) => id === parent?.parentId);

    return [space?.name, parent?.name, node.name].filter(Boolean).join(' / ');
  };

  if (!lists.length)
    return (
      <EmptyState
        title="No available lists"
        description="Ask a workspace administrator to create a list or grant you access."
      />
    );

  return (
    <Stack
      component="form"
      aria-label="Choose task list"
      noValidate
      spacing={1.2}
      onSubmit={handleSubmit(({ listId }) => {
        if (lists.some(({ id }) => id === listId)) onSelect(listId);
      })}
    >
      <FormFields
        control={control}
        fields={[
          {
            kind: 'select',
            name: 'listId',
            label: 'Destination list',
            required: true,
            options: lists.map((node) => ({ value: node.id, label: label(node) })),
          },
        ]}
      />
      <Button type="submit" variant="contained">
        Continue to task
      </Button>
    </Stack>
  );
}

function TaskDestination({
  runtime,
  scope,
  onSelect,
}: {
  onSelect: (id: string) => void;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const tree = useTree(runtime, scope);

  if (tree.state === 'loading')
    return (
      <Typography role="status" aria-label="Loading destination lists">
        Loading your lists…
      </Typography>
    );

  if (tree.state === 'error')
    return (
      <Stack spacing={1.2}>
        <Alert severity="error">{tree.message}</Alert>
        <Button onClick={tree.retry}>Retry lists</Button>
      </Stack>
    );

  return <DestinationForm nodes={tree.nodes} onSelect={onSelect} />;
}

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
