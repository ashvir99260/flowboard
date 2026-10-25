'use client';

import { Button, Typography } from '@flowboard/ui';
import { ConfirmDialog, DrawerPanel, ErrorState } from '@flowboard/ui';
import { createContext, useCallback, useContext, useRef, useState } from 'react';

import { ActivityFeed } from './activity-feed';
import { TaskForm } from './task-form';
import { TaskRelations } from './task-relations';
import { useTaskDetail } from './use-task-detail';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { Task } from '@flowboard/contracts';
import type { ReactNode } from 'react';

const TaskEditorContext = createContext<
  ((taskId: string | null, targetListId?: string) => void) | null
>(null);

type Selection = { listId: string; parentTaskId?: string; taskId?: string };
type DrawerAction = { type: 'close' | 'reload' } | { selection: Selection; type: 'navigate' };

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
  navigate,
  parentTaskId,
}: {
  close: () => void;
  listId: string;
  navigate: (selection: Selection) => void;
  parentTaskId?: string;
  runtime: ClientRuntime;
  scope: QueryScope;
  taskId?: string;
}) {
  const [lookupTaskId, setLookupTaskId] = useState(taskId);
  const persistedId = useRef(taskId);
  const [activityTaskId, setActivityTaskId] = useState(taskId);
  const [savedTask, setSavedTask] = useState<Task>();
  const { result, error, retry } = useTaskDetail(runtime, scope, listId, lookupTaskId);
  const [editing, setEditing] = useState({ dirty: false, busy: false });
  const [confirmation, setConfirmation] = useState<DrawerAction | null>(null);

  const perform = (action: DrawerAction) => {
    setConfirmation(null);
    setEditing({ dirty: false, busy: false });
    if (action.type === 'navigate') navigate(action.selection);
    else if (action.type === 'close') close();
    else if (persistedId.current) {
      setSavedTask(undefined);
      setLookupTaskId(persistedId.current);
      retry();
    } else close();
  };
  const request = (action: DrawerAction) => {
    if (editing.busy) return;

    if (editing.dirty) setConfirmation(action);
    else perform(action);
  };

  return (
    <DrawerPanel
      open
      title="Task details"
      closeLabel="Close task"
      closeDisabled={editing.busy}
      onClose={() => request({ type: 'close' })}
    >
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
            parentTaskId={parentTaskId}
            onState={setEditing}
            reload={() => request({ type: 'reload' })}
            onArchived={close}
            onPersisted={(task) => {
              persistedId.current = task.id;
              setActivityTaskId(task.id);
              setSavedTask(task);
            }}
          />
          {(savedTask ?? result.task) && (
            <TaskRelations
              task={(savedTask ?? result.task)!}
              busy={editing.busy}
              listId={listId}
              runtime={runtime}
              scope={scope}
              open={(id) => request({ type: 'navigate', selection: { taskId: id, listId } })}
              create={(id) =>
                request({ type: 'navigate', selection: { parentTaskId: id, listId } })
              }
            />
          )}
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
      <ConfirmDialog
        open={confirmation !== null}
        title="Discard unsaved changes?"
        description={
          confirmation?.type === 'reload'
            ? 'Reloading replaces your edits with the latest saved task.'
            : 'Your edits have not been saved.'
        }
        confirmLabel={confirmation?.type === 'reload' ? 'Discard and reload' : 'Discard changes'}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation) perform(confirmation);
        }}
      />
    </DrawerPanel>
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
  const [selection, setSelection] = useState<Selection | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const originTaskId = useRef<string | null>(null);
  const open = useCallback(
    (taskId: string | null, targetListId?: string) => {
      const destination = targetListId ?? listId;
      if (!destination) return;

      origin.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      originTaskId.current = taskId;
      setSelection({ taskId: taskId ?? undefined, listId: destination });
    },
    [listId],
  );

  const close = () => {
    const target = originTaskId.current;
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
          key={`${selection.listId}:${selection.taskId ?? `new:${selection.parentTaskId ?? ''}`}`}
          taskId={selection.taskId}
          listId={selection.listId}
          runtime={runtime}
          scope={scope}
          close={close}
          navigate={setSelection}
          parentTaskId={selection.parentTaskId}
        />
      )}
    </TaskEditorContext.Provider>
  );
}
