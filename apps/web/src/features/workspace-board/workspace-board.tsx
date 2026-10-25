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

import { useSession } from '../../providers/app-providers';
import { MoveMenu } from '../board/move-menu';
import { useTaskMutation } from '../board/use-task-mutation';
import { useNotifications } from '../notifications/notification-provider';
import { useRealtime } from '../realtime/realtime-provider';
import { useTree } from '../tree/use-tree';

import { useWorkspaceBoardQuery } from './use-workspace-board-query';
import { planWorkspaceMove, projectWorkspaceMoves } from './workspace-board-data';
import { WorkspaceBoardDnd } from './workspace-board-dnd';
import { WorkspaceMoveRepair } from './workspace-move-repair';

import type {
  WorkspaceBoardColumn,
  WorkspaceListNode,
  WorkspaceMoveSelection,
} from './workspace-board-data';
import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { Task } from '@flowboard/contracts';

function ListSubscription({ listId, refresh }: { listId: string; refresh: () => void }) {
  useRealtime(listId, (event) => {
    if (event.kind === 'list') refresh();
  });

  return null;
}

function ConnectedWorkspaceBoard({
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
  const [menu, setMenu] = useState<{ task: Task; column: WorkspaceBoardColumn } | null>(null);
  const lastTask = useRef<string | null>(null);
  const lastLists = useRef<readonly WorkspaceListNode[]>([]);
  const lists = useMemo(
    () =>
      tree.state === 'ready'
        ? tree.nodes.filter((node) => node.type === 'list')
        : lastLists.current,
    [tree],
  );
  if (tree.state === 'ready') lastLists.current = lists;

  const visible = useMemo(() => lists.slice(0, listLimit), [listLimit, lists]);
  const board = useWorkspaceBoardQuery(runtime, scope, visible);
  const { pending, submit, notice } = useTaskMutation(runtime, scope);
  const ready = board.columns.filter((column) => column.state === 'ready');
  const projected = projectWorkspaceMoves(ready, pending);
  const columns = board.columns.map((column) =>
    column.state === 'ready'
      ? { ...column, ...projected.find((item) => item.list.id === column.list.id) }
      : column,
  );
  const visibleIds = tree.state === 'ready' ? lists.map((list) => list.id).join(',') : null;

  useEffect(() => {
    if (visibleIds === null) return;

    const allowed = new Set(visibleIds.split(','));
    setRepair((current) =>
      current && (!allowed.has(current.source.list.id) || !allowed.has(current.destination.list.id))
        ? null
        : current,
    );
    setMenu((current) => (current && !allowed.has(current.column.list.id) ? null : current));
  }, [visibleIds]);

  const restoreFocus = () =>
    requestAnimationFrame(() => {
      const taskId = lastTask.current;
      const target = taskId
        ? document.querySelector<HTMLElement>(`[data-move-task="${CSS.escape(taskId)}"]`)
        : null;
      (
        target ?? document.querySelector<HTMLElement>('[aria-label="Workspace lists board"]')
      )?.focus();
    });
  const move = (taskId: string, destinationListId: string, index: number) => {
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
        <ListSubscription key={list.id} listId={list.id} refresh={() => board.retry()} />
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
          title="No visible lists"
          description="Create a list or ask a workspace administrator for access."
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
          {notice && (
            <Typography aria-live="off" role="status">
              {notice}
            </Typography>
          )}
          <BoardViewport role="region" aria-label="Workspace lists board" tabIndex={0}>
            <WorkspaceBoardDnd
              columns={columns}
              pending={new Set(pending.map((command) => command.taskId))}
              workspaceId={scope.workspaceId!}
              move={move}
              retry={board.retry}
              loadMore={board.loadMore}
              openMove={(task, column) => {
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
          submit={submit}
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
          submit={submit}
          onClose={() => {
            setMenu(null);
            restoreFocus();
          }}
        />
      )}
    </>
  );
}

export function WorkspaceBoard() {
  const { runtime, scope } = useSession();

  return runtime && scope ? (
    <ConnectedWorkspaceBoard
      key={`${scope.revision}:${scope.userId}:${scope.workspaceId}`}
      runtime={runtime}
      scope={scope}
    />
  ) : null;
}
