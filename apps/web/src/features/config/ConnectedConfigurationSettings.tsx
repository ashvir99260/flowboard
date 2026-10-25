'use client';

import {
  Button,
  ConfirmDialog,
  ErrorState,
  SelectionInput,
  Stack,
  Typography,
} from '@flowboard/ui';
import { useEffect, useRef, useState } from 'react';

import { useSession } from '../../providers/useSession';
import { useTree } from '../tree/useTree';

import type { ConfigurationSettingsProps } from './configurationTypes';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { StatusScope } from '@flowboard/contracts';

type Editing = { busy: boolean; dirty: boolean };

export function ConnectedConfigurationSettings({
  runtime,
  scope,
  active,
  kind,
  Editor,
}: ConfigurationSettingsProps & { runtime: ClientRuntime; scope: QueryScope }) {
  const { session } = useSession();
  const tree = useTree(runtime, scope);
  const [owner, setOwner] = useState<StatusScope>({
    ownerType: 'workspace',
    ownerId: scope.workspaceId!,
  });
  const [pending, setPending] = useState<StatusScope | null>(null);
  const [editing, setEditing] = useState<Editing>({ busy: false, dirty: false });
  const [activation, setActivation] = useState(0);
  const previouslyActive = useRef(active);

  useEffect(() => {
    const returning = active && !previouslyActive.current;
    previouslyActive.current = active;
    if (returning && !editing.dirty && !editing.busy) setActivation((value) => value + 1);
  }, [active, editing.dirty, editing.busy]);

  const nodes = tree.state === 'ready' ? tree.nodes : [];
  const changeOwner = (next: StatusScope) => {
    if (editing.busy || next.ownerId === owner.ownerId) return;

    if (editing.dirty) setPending(next);
    else {
      setOwner(next);
      setEditing({ busy: false, dirty: false });
    }
  };

  return (
    <Stack spacing={1.6}>
      <Typography component="h1" variant="h1">
        {kind === 'status' ? 'Status settings' : 'Field settings'}
      </Typography>
      <Typography>
        Configure inherited {kind === 'status' ? 'statuses' : 'fields'} one at a time. Changes can
        affect descendant lists.
      </Typography>
      <SelectionInput
        label="Configuration scope"
        value={owner.ownerId}
        disabled={editing.busy || tree.state !== 'ready'}
        options={[
          {
            value: scope.workspaceId!,
            label: `Workspace: ${session?.data.activeWorkspace?.name ?? ''}`,
          },
          ...nodes.map((node) => ({
            value: node.id,
            label: `${node.type[0]!.toUpperCase() + node.type.slice(1)}: ${node.name}`,
          })),
        ]}
        onChange={(value) => {
          if (typeof value !== 'string') return;

          const node = nodes.find((item) => item.id === value);
          changeOwner(
            node
              ? { ownerType: node.type, ownerId: node.id }
              : { ownerType: 'workspace', ownerId: scope.workspaceId! },
          );
        }}
      />
      {tree.state === 'error' && (
        <ErrorState
          title="Scopes unavailable"
          description={tree.message}
          action={<Button onClick={tree.retry}>Retry scopes</Button>}
        />
      )}
      <Editor
        active={active}
        key={`${owner.ownerType}:${owner.ownerId}:${activation}`}
        owner={owner}
        scope={scope}
        runtime={runtime}
        onState={setEditing}
      />
      <ConfirmDialog
        open={active && pending !== null}
        title={`Discard unsaved ${kind} changes?`}
        description={`Changing scope will discard the current ${kind} draft.`}
        confirmLabel="Discard and change scope"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) setOwner(pending);

          setPending(null);
          setEditing({ busy: false, dirty: false });
        }}
      />
    </Stack>
  );
}
