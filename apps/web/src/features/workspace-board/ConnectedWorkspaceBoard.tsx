'use client';

import {
  BoardViewport,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  Stack,
  Typography,
} from '@flowboard/ui';
import { useEffect, useMemo, useRef, useState } from 'react';

import { MoveMenu } from '../board/MoveMenu';
import { useTaskPlacementMutation } from '../board/useTaskPlacementMutation';
import { useNotifications } from '../notifications/useNotifications';
import { useTree } from '../tree/useTree';

import { useWorkspaceBoardQuery } from './useWorkspaceBoardQuery';
import { planWorkspaceMove, projectWorkspaceMoves } from './workspaceBoardData';
import { WorkspaceBoardDnd } from './WorkspaceBoardDnd';
import { WorkspaceListSubscription } from './WorkspaceListSubscription';
import { WorkspaceMoveRepair } from './WorkspaceMoveRepair';

import type { WorkspaceBoardColumn, WorkspaceMoveSelection } from './workspaceBoardData';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { Task } from '@flowboard/contracts';

export function ConnectedWorkspaceBoard({
  runtime,
  scope,
}: {
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const notifications = useNotifications();
  const tree = useTree(runtime, scope);
  const [listLimit, setListLimit] = useState(10);
  const [repair, setRepair] = useState<WorkspaceMoveSelection | null>(null);
  const [menu, setMenu] = useState<{ column: WorkspaceBoardColumn; task: Task } | null>(null);
  const lastTask = useRef<string | null>(null);
  const focusPending = useRef(false);
  const [focusTick, setFocusTick] = useState(0);
  const lists = useMemo(
    () => (tree.state === 'ready' ? tree.nodes.filter((node) => node.type === 'list') : []),
    [tree],
  );

  const visible = useMemo(() => lists.slice(0, listLimit), [listLimit, lists]);
  const board = useWorkspaceBoardQuery(runtime, scope, visible);
  const { pending, submit } = useTaskPlacementMutation(runtime, scope);

  const ready = board.columns.filter((column) => column.state === 'ready');
  const projected = projectWorkspaceMoves(ready, pending);
  const columns = board.columns.map((column) =>
    column.state === 'ready'
      ? { ...column, ...projected.find((item) => item.list.id === column.list.id) }
      : column,
  );
  const visibleIds = tree.state === 'ready' ? lists.map((list) => list.id).join(',') : null;
  const submitMove: typeof submit = (command) =>
    board.refreshing
      ? Promise.resolve({
          success: false,
          error: { code: 'BUSY', message: 'Wait for the board to finish updating.' },
        })
      : submit(command);

  if (visibleIds !== null) {
    const allowed = new Set(visibleIds.split(','));
    if (repair && (!allowed.has(repair.source.list.id) || !allowed.has(repair.destination.list.id)))
      setRepair(null);

    if (menu && !allowed.has(menu.column.list.id)) setMenu(null);
  }

  const restoreFocus = () => {
    focusPending.current = true;
    setFocusTick((current) => current + 1);
  };

  useEffect(() => {
    if (!focusPending.current || board.refreshing || tree.state !== 'ready') return;

    const taskId = lastTask.current;
    const target = taskId
      ? document.querySelector<HTMLElement>(`[data-move-task="${CSS.escape(taskId)}"]`)
      : null;
    (
      target ?? document.querySelector<HTMLElement>('[aria-label="Workspace lists board"]')
    )?.focus();
    focusPending.current = false;
  }, [board.refreshing, focusTick, tree.state]);

  const move = (taskId: string, destinationListId: string, index: number) => {
    if (board.refreshing) return;

    const plan = planWorkspaceMove(projected, taskId, destinationListId, index);
    lastTask.current = taskId;
    if (plan.kind === 'repair') {
      setRepair(plan.selection);

      return;
    }

    if (plan.kind === 'blocked') {
      notifications.capture()(plan.message, 'error');
      restoreFocus();

      return;
    }

    void submit(plan.command).then(restoreFocus);
  };

  return (
    <>
      {visible.map((list) => (
        <WorkspaceListSubscription key={list.id} listId={list.id} refresh={board.refreshTasks} />
      ))}
      {tree.state === 'loading' ? (
        <LoadingState>Loading workspace lists…</LoadingState>
      ) : tree.state === 'error' ? (
        <ErrorState
          title="Workspace lists unavailable"
          description={tree.message}
          action={<Button onClick={tree.retry}>Retry workspace board</Button>}
        />
      ) : !lists.length ? (
        <EmptyState
          description="Create a list or ask a workspace administrator for access."
          title="No visible lists"
        />
      ) : (
        <Stack spacing={1.6} sx={{ minWidth: 0 }}>
          <Stack
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 0.8 }}
          >
            <Typography component="h1" variant="h1">
              Workspace board
            </Typography>
            <Button
              onClick={() => {
                tree.retry();
                board.retry();
              }}
            >
              Refresh workspace board
            </Button>
          </Stack>
          <Typography color="text.secondary">
            Each column is a list. Tasks stay grouped by status; drag within a group to reorder or
            into another list to move.
          </Typography>
          <BoardViewport
            role="region"
            aria-label="Workspace lists board"
            aria-busy={board.refreshing}
            tabIndex={0}
          >
            <WorkspaceBoardDnd
              columns={columns}
              pending={
                new Set(
                  board.refreshing
                    ? ready.flatMap((column) => column.tasks.map((task) => task.id))
                    : pending.map((command) => command.taskId),
                )
              }
              workspaceId={scope.workspaceId!}
              move={move}
              retry={board.retry}
              loadMore={board.loadMore}
              openMove={(task, column) => {
                if (board.refreshing) return;

                lastTask.current = task.id;
                setMenu({ task, column });
              }}
            />
          </BoardViewport>
          {visible.length < lists.length && (
            <Button onClick={() => setListLimit((current) => current + 10)}>
              Show more lists ({visible.length} of {lists.length} loaded)
            </Button>
          )}
        </Stack>
      )}
      {repair && (
        <WorkspaceMoveRepair
          selection={repair}
          submit={submitMove}
          onClose={() => {
            setRepair(null);
            restoreFocus();
          }}
        />
      )}
      {menu && (
        <MoveMenu
          task={menu.task}
          sourceStatus={menu.column.statuses.find((status) => status.id === menu.task.statusId)!}
          configVersion={menu.column.configVersion}
          columns={menu.column.statuses.map((status) => ({
            status,
            nextCursor: null,
            tasks: menu.column.tasks.filter((task) => task.statusId === status.id),
          }))}
          runtime={runtime}
          scope={scope}
          submit={submitMove}
          onClose={() => {
            setMenu(null);
            restoreFocus();
          }}
        />
      )}
    </>
  );
}
