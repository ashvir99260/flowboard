'use client';

import {
  Alert,
  Button,
  ConfirmDialog,
  ErrorState,
  FormField,
  MemberAccess,
  Stack,
  Typography,
} from '@flowboard/ui';
import { useRef, useState } from 'react';

import { SessionLoading } from '../auth/SessionLoading';

import { containerLabel } from './administrationData';
import { AdministrationForm } from './AdministrationForm';
import { useAdministration } from './useAdministration';
import { useAdministrationMutation } from './useAdministrationMutation';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { AdministrationSelection } from './administrationCommands';
import type { AdministrationSnapshot } from './administrationData';
import type { AdministrationCommand } from './useAdministrationMutation';

type PendingAction =
  | { kind: 'select'; selection: AdministrationSelection }
  | { kind: 'reload' }
  | { kind: 'command'; command: AdministrationCommand };

export function AdministrationWorkspace({
  runtime,
  scope,
  active,
}: {
  active: boolean;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const [selection, setSelection] = useState<AdministrationSelection>({ kind: 'create' });
  const [snapshot, setSnapshot] = useState<AdministrationSnapshot | null>(null);
  const [editing, setEditing] = useState({ dirty: false, busy: false });
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [reloading, setReloading] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = useRef(false);
  const nodeId = 'nodeId' in selection ? selection.nodeId : undefined;
  const data = useAdministration(runtime, scope, nodeId);
  const { submit } = useAdministrationMutation(runtime, scope);

  if (!snapshot && data.result.state === 'ready') setSnapshot(data.result.snapshot);

  if (reloading !== null && data.generation >= reloading) {
    if (data.result.state === 'ready') {
      setSnapshot(data.result.snapshot);
      setEpoch((value) => value + 1);
      setEditing({ dirty: false, busy: false });
      setBlocked(false);
      setNotice(null);
      setReloading(null);
    } else if (data.error || data.result.state === 'invalid' || data.result.state === 'stale') {
      setReloading(null);
      setNotice('Administration could not reload. Your draft is kept.');
    }
  }

  const disabled = busy || editing.busy || reloading !== null;
  const stale =
    blocked ||
    (snapshot !== null &&
      data.result.state === 'ready' &&
      data.result.snapshot.configVersion !== snapshot.configVersion);
  const node = snapshot?.nodes.find((item) => item.id === nodeId);
  const siblings =
    snapshot?.nodes
      .filter((item) => item.parentId === node?.parentId)
      .toSorted(
        (left, right) => left.position - right.position || left.id.localeCompare(right.id),
      ) ?? [];
  const position = siblings.findIndex((item) => item.id === nodeId);
  const refreshAfterSave = (createdId?: string, archived = false) => {
    if (archived) setSelection({ kind: 'create' });
    else if (createdId && selection.kind === 'create')
      setSelection({ kind: 'details', nodeId: createdId });

    setSnapshot(null);
    setEditing({ dirty: false, busy: false });
    setBlocked(false);
    setNotice(null);
    setEpoch((value) => value + 1);
    data.refresh();
  };
  const perform = (action: PendingAction) => {
    setPending(null);
    if (action.kind === 'select') {
      setSelection(action.selection);
      setSnapshot(null);
      setEditing({ dirty: false, busy: false });
      setEpoch((value) => value + 1);
      setBlocked(false);
      setNotice(null);

      return;
    }

    if (action.kind === 'reload') {
      setReloading(data.generation + 1);
      data.refresh();

      return;
    }

    if (locked.current) return;

    locked.current = true;
    setBusy(true);
    setNotice(null);
    void submit(action.command)
      .then((result) => {
        if (result.success)
          refreshAfterSave(result.response?.data.id, action.command.kind === 'archive');
        else {
          setNotice(result.error.message);
          setBlocked(
            ['VERSION_CONFLICT', 'CONFIG_CONFLICT', 'INVALID_RESPONSE'].includes(result.error.code),
          );
        }
      })
      .finally(() => {
        locked.current = false;
        setBusy(false);
      });
  };
  const request = (action: PendingAction) => {
    if (disabled) return;

    if (action.kind === 'select' && JSON.stringify(action.selection) === JSON.stringify(selection))
      return;

    if (editing.dirty || (action.kind === 'command' && action.command.kind === 'archive'))
      setPending(action);
    else perform(action);
  };
  const reorder = (direction: 'up' | 'down') => {
    if (!node || !snapshot) return;

    const anchor = siblings[position + (direction === 'up' ? -1 : 1)];
    if (!anchor) return;

    request({
      kind: 'command',
      command: {
        kind: 'reorder',
        nodeId: node.id,
        body: {
          expectedConfigVersion: snapshot.configVersion,
          expectedVersion: node.version,
          placement: direction === 'up' ? { beforeId: anchor.id } : { afterId: anchor.id },
        },
      },
    });
  };
  const archiving = pending?.kind === 'command' && pending.command.kind === 'archive';

  return (
    <Stack spacing={2}>
      <Typography component="h1" variant="h1">
        Container administration
      </Typography>
      <Typography>
        Create and arrange spaces, folders and lists, then manage member access.
      </Typography>
      {(notice || data.error) && <Alert severity="error">{notice ?? data.error?.message}</Alert>}
      {!snapshot ? (
        data.error || data.result.state === 'invalid' || data.result.state === 'stale' ? (
          <ErrorState
            title="Administration unavailable"
            description={
              data.error?.message ?? 'The administration snapshot could not be verified.'
            }
            action={<Button onClick={data.refresh}>Retry administration</Button>}
          />
        ) : (
          <SessionLoading />
        )
      ) : (
        <>
          <FormField
            select
            label="Selected container"
            value={nodeId ?? ''}
            disabled={disabled}
            slotProps={{ select: { native: true } }}
            onChange={(event) =>
              request({
                kind: 'select',
                selection: event.target.value
                  ? { kind: 'details', nodeId: event.target.value }
                  : { kind: 'create' },
              })
            }
          >
            <option value="">New container</option>
            {snapshot.nodes.map((item) => (
              <option key={item.id} value={item.id}>
                {containerLabel(item, snapshot.nodes)}
              </option>
            ))}
          </FormField>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button
              disabled={disabled}
              onClick={() => request({ kind: 'select', selection: { kind: 'create' } })}
            >
              New container
            </Button>
            {node && (
              <>
                <Button
                  disabled={disabled}
                  onClick={() =>
                    request({ kind: 'select', selection: { kind: 'details', nodeId: node.id } })
                  }
                >
                  Edit details
                </Button>
                <Button disabled={disabled || stale || position <= 0} onClick={() => reorder('up')}>
                  Move container up
                </Button>
                <Button
                  disabled={disabled || stale || position < 0 || position >= siblings.length - 1}
                  onClick={() => reorder('down')}
                >
                  Move container down
                </Button>
                {node.type !== 'space' && (
                  <Button
                    disabled={disabled || stale}
                    onClick={() =>
                      request({ kind: 'select', selection: { kind: 'move', nodeId: node.id } })
                    }
                  >
                    Change parent
                  </Button>
                )}
                <Button
                  color="error"
                  disabled={disabled || stale}
                  onClick={() =>
                    request({
                      kind: 'command',
                      command: {
                        kind: 'archive',
                        nodeId: node.id,
                        body: {
                          expectedConfigVersion: snapshot.configVersion,
                          expectedVersion: node.version,
                        },
                      },
                    })
                  }
                >
                  Archive container
                </Button>
              </>
            )}
          </Stack>
          <AdministrationForm
            key={epoch}
            active={active}
            snapshot={snapshot}
            selection={selection}
            runtime={runtime}
            scope={scope}
            stale={stale || reloading !== null || busy}
            onState={setEditing}
            onSaved={refreshAfterSave}
            onReload={() => request({ kind: 'reload' })}
          />
          {node && (
            <MemberAccess
              key={node.id}
              members={snapshot.members}
              grants={snapshot.grants}
              busy={disabled}
              onEdit={(userId) =>
                request({ kind: 'select', selection: { kind: 'grant', nodeId: node.id, userId } })
              }
            />
          )}
        </>
      )}
      <ConfirmDialog
        open={active && pending !== null}
        busy={disabled}
        title={archiving ? 'Archive container and descendants?' : 'Discard unsaved changes?'}
        description={
          archiving
            ? `Archive ${node?.name ?? 'this container'}, all descendant containers and their live tasks? Data is retained. Unsaved edits will not be saved.`
            : 'Continue and discard the current administration draft? A failed reload keeps the draft.'
        }
        confirmLabel={archiving ? 'Archive subtree' : 'Discard and continue'}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) perform(pending);
        }}
      />
    </Stack>
  );
}
