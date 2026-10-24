'use client';

import { ConfirmDialog, ErrorState } from '@flowboard/ui';
import Button from '@mui/material/Button';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { createContext, useCallback, useContext, useId, useRef, useState } from 'react';

import { ActivityFeed } from './activity-feed';
import { TaskForm } from './task-form';
import { useTaskDetail } from './use-task-detail';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { ReactNode } from 'react';

const TaskEditorContext = createContext<((taskId: string | null) => void) | null>(null);

export function useTaskEditor() {
  const open = useContext(TaskEditorContext);
  if (!open) throw new Error('Task controls require TaskEditorProvider');

  return open;
}

function TaskDrawer({
  taskId,
  listId,
  runtime,
  scope,
  close,
}: {
  close: () => void;
  listId: string;
  runtime: ClientRuntime;
  scope: QueryScope;
  taskId?: string;
}) {
  const id = useId();
  const [lookupTaskId, setLookupTaskId] = useState(taskId);
  const persistedId = useRef(taskId);
  const [activityTaskId, setActivityTaskId] = useState(taskId);
  const { result, error, retry } = useTaskDetail(runtime, scope, listId, lookupTaskId);
  const [editing, setEditing] = useState({ dirty: false, busy: false });
  const [confirmation, setConfirmation] = useState<'close' | 'reload' | null>(null);
  const perform = (action: 'close' | 'reload') => {
    setConfirmation(null);
    setEditing({ dirty: false, busy: false });
    if (action === 'close') close();
    else if (persistedId.current) {
      setLookupTaskId(persistedId.current);
      retry();
    } else close();
  };
  const request = (action: 'close' | 'reload') => {
    if (editing.busy) return;

    if (editing.dirty) setConfirmation(action);
    else perform(action);
  };

  return (
    <Drawer
      open
      anchor="right"
      onClose={() => request('close')}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-labelledby': id,
          sx: { width: { xs: '100%', sm: 560 }, maxWidth: '100%', p: 3 },
        },
      }}
    >
      <Stack spacing={3}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography component="h2" variant="h2" id={id}>
            Task details
          </Typography>
          <Button autoFocus disabled={editing.busy} onClick={() => request('close')}>
            Close task
          </Button>
        </Stack>
        {error || result.state === 'invalid' || result.state === 'stale' ? (
          <ErrorState
            title="Task unavailable"
            description={error?.message ?? 'The task changed or could not be displayed. Try again.'}
            action={<Button onClick={retry}>Retry task</Button>}
          />
        ) : result.state !== 'ready' ? (
          <Typography role="status">Loading task…</Typography>
        ) : (
          <>
            <TaskForm
              detail={result}
              listId={listId}
              runtime={runtime}
              scope={scope}
              onState={setEditing}
              reload={() => request('reload')}
              onArchived={close}
              onPersisted={(id) => {
                persistedId.current = id;
                setActivityTaskId(id);
              }}
            />
            {activityTaskId && (
              <ActivityFeed
                key={activityTaskId}
                taskId={activityTaskId}
                runtime={runtime}
                scope={scope}
                statuses={result.statuses}
              />
            )}
          </>
        )}
      </Stack>
      <ConfirmDialog
        open={confirmation !== null}
        title="Discard unsaved changes?"
        description={
          confirmation === 'reload'
            ? 'Reloading replaces your edits with the latest saved task.'
            : 'Your edits have not been saved.'
        }
        confirmLabel={confirmation === 'reload' ? 'Discard and reload' : 'Discard changes'}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation) perform(confirmation);
        }}
      />
    </Drawer>
  );
}

export function TaskEditorProvider({
  children,
  listId,
  runtime,
  scope,
}: {
  children: ReactNode;
  listId?: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const [selection, setSelection] = useState<{ listId: string; taskId?: string } | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const open = useCallback(
    (taskId: string | null) => {
      if (!listId) return;

      origin.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSelection({ taskId: taskId ?? undefined, listId });
    },
    [listId],
  );
  const close = () => {
    const target = selection?.taskId;
    setSelection(null);
    requestAnimationFrame(() => {
      const element = origin.current?.isConnected
        ? origin.current
        : document.querySelector<HTMLElement>(`[data-open-task="${target}"]`);
      const fallback = document.querySelector<HTMLElement>('main h1');
      if (!element && fallback) fallback.tabIndex = -1;

      (element ?? fallback)?.focus();
    });
  };

  return (
    <TaskEditorContext.Provider value={open}>
      {children}
      {selection && (
        <TaskDrawer
          key={`${selection.listId}:${selection.taskId ?? 'new'}`}
          taskId={selection.taskId}
          listId={selection.listId}
          runtime={runtime}
          scope={scope}
          close={close}
        />
      )}
    </TaskEditorContext.Provider>
  );
}
