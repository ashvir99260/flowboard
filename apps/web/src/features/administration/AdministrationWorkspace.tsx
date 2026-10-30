'use client';

import {
  Alert,
  Button,
  ConfirmDialog,
  ErrorState,
  SettingsDetailPanel,
  SettingsLayout,
  Stack,
  Toolbar,
  Typography,
  WorkspaceIcon,
} from '@flowboard/ui';
import { useEffect, useRef, useState } from 'react';

import { apiError } from '../../lib/apiError';
import { SessionLoading } from '../auth/SessionLoading';

import { AdministrationEditor } from './AdministrationEditor';
import { ContainerHierarchy } from './ContainerHierarchy';
import { useAdministration } from './useAdministration';
import { useAdministrationMutation } from './useAdministrationMutation';

import type { AdministrationSelection } from './administrationCommands';
import type { AdministrationSnapshot } from './administrationData';
import type { AdministrationCommand } from './useAdministrationMutation';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

type PendingAction =
  | { kind: 'select'; selection: AdministrationSelection }
  | { kind: 'close' }
  | { kind: 'reload' }
  | { command: AdministrationCommand; kind: 'command' };

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
  const [panelOpen, setPanelOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<AdministrationSnapshot | null>(null);
  const [loadingSelection, setLoadingSelection] = useState(false);
  const [editing, setEditing] = useState({ dirty: false, busy: false });
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [reloading, setReloading] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = useRef(false);
  const origin = useRef<HTMLElement | null>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  const nodeId = panelOpen && 'nodeId' in selection ? selection.nodeId : undefined;

  const data = useAdministration(runtime, scope, nodeId);
  const { mutateAsync } = useAdministrationMutation(runtime, scope);

  if ((!snapshot || loadingSelection) && data.result.state === 'ready') {
    setSnapshot(data.result.snapshot);
    setLoadingSelection(false);
  }

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

  const selectionFailed = Boolean(data.error) || ['invalid', 'stale'].includes(data.result.state);
  const disabled =
    busy || editing.busy || reloading !== null || (loadingSelection && !selectionFailed);

  useEffect(() => {
    if (!active || !restoreFocus.current || disabled) return;

    let target = origin.current;
    while (target && (!target.isConnected || target.getClientRects().length === 0))
      target = target.closest('li')?.parentElement?.closest('li')?.querySelector('button') ?? null;

    (target ?? createButton.current)?.focus();
    restoreFocus.current = false;
  }, [active, disabled, panelOpen]);

  const stale =
    blocked ||
    (snapshot !== null &&
      data.result.state === 'ready' &&
      data.result.snapshot.configVersion !== snapshot.configVersion);
  const node = snapshot?.nodes.find((item) => item.id === nodeId);
  const refreshAfterSave = (createdId?: string, archived = false) => {
    if (archived) {
      setPanelOpen(false);
      setSelection({ kind: 'create' });
      restoreFocus.current = true;
    } else if (createdId && selection.kind === 'create')
      setSelection({ kind: 'details', nodeId: createdId });

    setLoadingSelection(true);
    setEditing({ dirty: false, busy: false });
    setBlocked(false);
    setNotice(null);
    setEpoch((value) => value + 1);
    data.refresh();
  };
  const perform = (action: PendingAction) => {
    setPending(null);
    if (action.kind === 'close') {
      setPanelOpen(false);
      setSelection({ kind: 'create' });
      setEditing({ dirty: false, busy: false });
      setLoadingSelection(false);
      setEpoch((value) => value + 1);
      restoreFocus.current = true;

      return;
    }

    if (action.kind === 'select') {
      setPanelOpen(true);
      setSelection(action.selection);
      setLoadingSelection(true);
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
    void mutateAsync(action.command)
      .then((response) => refreshAfterSave(response?.data.id, action.command.kind === 'archive'))
      .catch((cause) => {
        const error = apiError(cause);
        setNotice(error.message);
        setBlocked(
          ['VERSION_CONFLICT', 'CONFIG_CONFLICT', 'INVALID_RESPONSE'].includes(error.code),
        );
      })
      .finally(() => {
        locked.current = false;
        setBusy(false);
      });
  };
  const request = (action: PendingAction) => {
    if (disabled) return;

    if (
      panelOpen &&
      action.kind === 'select' &&
      JSON.stringify(action.selection) === JSON.stringify(selection)
    )
      return;

    if (
      action.kind === 'select' &&
      document.activeElement instanceof HTMLElement &&
      !document.activeElement.closest('[data-settings-panel]')
    )
      origin.current = document.activeElement;

    if (editing.dirty || (action.kind === 'command' && action.command.kind === 'archive'))
      setPending(action);
    else perform(action);
  };
  const archiving = pending?.kind === 'command' && pending.command.kind === 'archive';

  return (
    <Stack spacing={2}>
      <Toolbar.Root>
        <Stack spacing={0.8}>
          <Typography component="h1" variant="h1">
            Containers and access
          </Typography>
          <Typography color="text.secondary">
            Organize spaces, folders and lists. Select a container to manage its details and access.
          </Typography>
        </Stack>
        <Button
          ref={createButton}
          variant="contained"
          disabled={disabled || !snapshot}
          startIcon={<WorkspaceIcon name="plus" />}
          onClick={() => request({ kind: 'select', selection: { kind: 'create' } })}
        >
          New container
        </Button>
      </Toolbar.Root>
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
        <SettingsLayout
          collection={
            <Stack component="section" aria-label="Container hierarchy" spacing={1.6}>
              <Typography component="h2" variant="h3">
                All containers
              </Typography>
              {snapshot.nodes.length === 0 ? (
                <Typography color="text.secondary">
                  No containers yet. Create a space to get started.
                </Typography>
              ) : (
                <ContainerHierarchy
                  nodes={snapshot.nodes}
                  selectedId={nodeId}
                  onSelect={(id) =>
                    request({ kind: 'select', selection: { kind: 'details', nodeId: id } })
                  }
                />
              )}
            </Stack>
          }
          detail={
            panelOpen && (
              <SettingsDetailPanel
                active={active}
                title={node ? 'Container details' : 'New container'}
                closeLabel="Close container details"
                closeDisabled={disabled}
                onClose={() => request({ kind: 'close' })}
              >
                {loadingSelection ? (
                  selectionFailed ? (
                    <ErrorState
                      title="Container unavailable"
                      description={data.error?.message ?? 'The container could not be loaded.'}
                      action={<Button onClick={data.refresh}>Retry container</Button>}
                    />
                  ) : (
                    <SessionLoading />
                  )
                ) : (
                  <AdministrationEditor
                    active={active}
                    disabled={disabled}
                    epoch={epoch}
                    runtime={runtime}
                    scope={scope}
                    selection={selection}
                    snapshot={snapshot}
                    stale={stale || reloading !== null || busy}
                    onCommand={(command) => request({ kind: 'command', command })}
                    onSelect={(next) => request({ kind: 'select', selection: next })}
                    onState={setEditing}
                    onSaved={refreshAfterSave}
                    onReload={() => request({ kind: 'reload' })}
                  />
                )}
              </SettingsDetailPanel>
            )
          }
        />
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
