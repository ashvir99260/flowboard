'use client';

import { Button, ConfirmDialog, DrawerPanel, ErrorState, Typography } from '@flowboard/ui';
import { useRef, useState } from 'react';

import { ActivityFeed } from './ActivityFeed';
import { TaskForm } from './TaskForm';
import { TaskRelations } from './TaskRelations';
import { useTaskDetail } from './useTaskDetail';

import type { Selection } from './taskEditorTypes';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { Task } from '@flowboard/contracts';

type DrawerAction = { type: 'close' | 'reload' } | { selection: Selection; type: 'navigate' };

export function TaskDrawer({
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
