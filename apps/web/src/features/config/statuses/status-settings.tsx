'use client';

import { ConfirmDialog, ErrorState, FormField } from '@flowboard/ui';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';

import { useSession } from '../../../providers/app-providers';
import { SessionLoading } from '../../auth/session-gate';
import { useTree } from '../../tree/use-tree';

import { StatusForm } from './status-form';
import { StatusPreview } from './status-preview';
import { useStatusConfiguration } from './use-status-configuration';

import type { QueryScope } from '../../../lib/query-scope';
import type { ClientRuntime } from '../../../providers/app-providers';
import type { StatusScope } from '@flowboard/contracts';

type Editing = { busy: boolean; dirty: boolean };

function ScopeConfiguration({
  active,
  owner,
  runtime,
  scope,
  onState,
}: {
  active: boolean;
  onState: (state: Editing) => void;
  owner: StatusScope;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const { result, error, retry } = useStatusConfiguration(runtime, scope, owner);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const open = (id: string) => {
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(id);
    setNotice(null);
  };
  const close = () => {
    setEditing(null);
    onState({ busy: false, dirty: false });
    requestAnimationFrame(() => origin.current?.isConnected && origin.current.focus());
  };
  const reload = () => {
    close();
    retry();
  };
  if (error || result.state === 'invalid' || result.state === 'stale')
    return (
      <ErrorState
        title={error?.code === 'FORBIDDEN' ? 'Access denied' : 'Status configuration unavailable'}
        description={error?.message ?? 'The configuration changed or could not be validated.'}
        action={<Button onClick={retry}>Reload configuration</Button>}
      />
    );

  if (result.state !== 'ready') return <SessionLoading />;

  return (
    <Stack spacing={4}>
      {notice && (
        <Alert role="status" severity="success">
          {notice}
        </Alert>
      )}
      <StatusPreview items={result.effective} />
      <Stack component="section" aria-label="Status configuration" spacing={2}>
        <Typography component="h2" variant="h3">
          Statuses
        </Typography>
        {result.input.identities.map((identity) => {
          const effective = result.effective.find((item) => item.id === identity.id);
          const local = result.local.find((item) => item.identity.id === identity.id);
          const name =
            effective?.name ??
            result.input.overrides.findLast(
              (item) => item.statusId === identity.id && item.name !== null,
            )?.name ??
            identity.key;

          return (
            <Stack
              component="section"
              aria-label={`Status ${identity.key}`}
              key={identity.id}
              direction="row"
              spacing={2}
              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Typography>{name}</Typography>
              <Chip label={local ? 'Local' : 'Inherited'} size="small" />
              {!effective && <Chip label="Hidden" size="small" />}
              <Typography variant="caption">
                {identity.key} · {identity.category}
              </Typography>
              <Button disabled={editing !== null} onClick={() => open(identity.id)}>
                Edit {name}
              </Button>
            </Stack>
          );
        })}
        <Button variant="outlined" disabled={editing !== null} onClick={() => open('new')}>
          Add status
        </Button>
      </Stack>
      {editing && (
        <StatusForm
          active={active}
          key={editing}
          configuration={result}
          targetId={editing === 'new' ? undefined : editing}
          runtime={runtime}
          scope={scope}
          onState={onState}
          onClose={close}
          onReload={reload}
          onSaved={() => {
            reload();
            setNotice('Status saved.');
          }}
        />
      )}
    </Stack>
  );
}

function Settings({
  runtime,
  scope,
  active,
}: {
  active: boolean;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
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
    <Stack spacing={4}>
      <Typography component="h1" variant="h1">
        Status settings
      </Typography>
      <Typography>
        Configure inherited statuses one at a time. Changes can affect descendant lists.
      </Typography>
      <FormField
        label="Configuration scope"
        value={owner.ownerId}
        select
        disabled={editing.busy || tree.state !== 'ready'}
        slotProps={{ select: { native: true } }}
        onChange={(event) => {
          const node = nodes.find((item) => item.id === event.target.value);
          changeOwner(
            node
              ? { ownerType: node.type, ownerId: node.id }
              : { ownerType: 'workspace', ownerId: scope.workspaceId! },
          );
        }}
      >
        <option value={scope.workspaceId!}>Workspace: {session?.data.activeWorkspace?.name}</option>
        {nodes.map((node) => (
          <option key={node.id} value={node.id}>
            {node.type[0]!.toUpperCase() + node.type.slice(1)}: {node.name}
          </option>
        ))}
      </FormField>
      {tree.state === 'error' && (
        <ErrorState
          title="Scopes unavailable"
          description={tree.message}
          action={<Button onClick={tree.retry}>Retry scopes</Button>}
        />
      )}
      <ScopeConfiguration
        active={active}
        key={`${owner.ownerType}:${owner.ownerId}:${activation}`}
        owner={owner}
        scope={scope}
        runtime={runtime}
        onState={setEditing}
      />
      <ConfirmDialog
        open={active && pending !== null}
        title="Discard unsaved status changes?"
        description="Changing scope will discard the current status draft."
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

export function StatusSettings({ active = true }: { active?: boolean }) {
  const { runtime, scope, session } = useSession();
  if (!runtime || !scope) return <SessionLoading />;

  if (session?.data.activeWorkspace?.role !== 'admin')
    return (
      <ErrorState
        description="Only workspace administrators can configure statuses. Effective statuses remain visible on each list."
        title="Access denied"
      />
    );

  return <Settings runtime={runtime} scope={scope} active={active} />;
}
