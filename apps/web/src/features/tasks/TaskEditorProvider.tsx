'use client';

import { useCallback, useRef, useState } from 'react';

import { TaskDrawer } from './TaskDrawer';
import { TaskEditorContext } from './taskEditorContext';

import type { Selection } from './taskEditorTypes';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { ReactNode } from 'react';

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
