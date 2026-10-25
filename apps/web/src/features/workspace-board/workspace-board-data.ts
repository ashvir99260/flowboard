import { selectTaskStatus } from '@flowboard/contracts';

import { prepareMoveFields } from '../board/task-placement.ts';

import type { TaskPlacement } from '../board/task-placement';
import type {
  NodeEnvelope,
  Placement,
  ResolvedField,
  ResolvedStatus,
  Task,
} from '@flowboard/contracts';

export type WorkspaceListNode = NodeEnvelope['data'];

export interface WorkspaceBoardColumn {
  readonly configVersion: number;
  readonly dataVersion: number;
  readonly fields: readonly ResolvedField[];
  readonly list: WorkspaceListNode;
  readonly nextCursor: string | null;
  readonly statuses: readonly ResolvedStatus[];
  readonly tasks: readonly Task[];
}

export interface WorkspaceMoveSelection {
  readonly destination: WorkspaceBoardColumn;
  readonly source: WorkspaceBoardColumn;
  readonly sourceStatus: ResolvedStatus;
  readonly task: Task;
}

type MovePlan =
  | { kind: 'blocked'; message: string }
  | { kind: 'ready'; command: TaskPlacement }
  | { kind: 'repair'; selection: WorkspaceMoveSelection };

/** Independent list reads must form one revision before sharing a DnD context. */
export function workspaceSnapshotState(columns: readonly WorkspaceBoardColumn[]) {
  const first = columns[0];
  if (!first) return 'ready' as const;

  if (
    columns.some(
      (column) =>
        column.configVersion !== first.configVersion || column.dataVersion !== first.dataVersion,
    )
  )
    return 'stale' as const;

  const tasks = columns.flatMap((column) => column.tasks.map((task) => task.id));

  return new Set(tasks).size === tasks.length ? ('ready' as const) : ('invalid' as const);
}

function placementFor(
  tasks: readonly Task[],
  taskId: string,
  statusId: string,
  targetIndex: number,
): Placement {
  const others = tasks.filter((task) => task.id !== taskId);
  const index = Math.max(0, Math.min(targetIndex, others.length));
  const next = others.slice(index).find((task) => task.statusId === statusId);
  if (next) return { beforeId: next.id };

  const previous = others.slice(0, index).findLast((task) => task.statusId === statusId);

  return previous ? { afterId: previous.id } : { edge: 'start' };
}

/** A list is grouped by its own statuses; dragging never creates cross-status ordering. */
export function planWorkspaceMove(
  columns: readonly WorkspaceBoardColumn[],
  taskId: string,
  destinationListId: string,
  targetIndex: number,
): MovePlan {
  const source = columns.find((column) => column.tasks.some((task) => task.id === taskId));
  const destination = columns.find((column) => column.list.id === destinationListId);
  const task = source?.tasks.find((item) => item.id === taskId);
  const sourceStatus = source?.statuses.find((status) => status.id === task?.statusId);
  if (!source || !destination || !task || !sourceStatus)
    return { kind: 'blocked', message: 'Wait for both lists to finish loading before moving.' };

  if (source.configVersion !== destination.configVersion)
    return { kind: 'blocked', message: 'List settings changed. Refresh the workspace board.' };

  const selected = selectTaskStatus(sourceStatus, destination.statuses);
  const prepared = prepareMoveFields(task.customFields, destination.fields, {});
  if (!selected.success || !prepared.success || prepared.removedKeys.length > 0)
    return { kind: 'repair', selection: { destination, source, sourceStatus, task } };

  return {
    kind: 'ready',
    command: {
      taskId,
      sourceListId: source.list.id,
      sourceStatusId: task.statusId,
      request: {
        destinationListId,
        statusId: selected.statusId,
        expectedVersion: task.version,
        expectedConfigVersion: source.configVersion,
        placement: placementFor(destination.tasks, taskId, selected.statusId, targetIndex),
        ...(Object.keys(prepared.patch).length ? { customFields: prepared.patch } : {}),
      },
    },
  };
}

function previewIndex(column: WorkspaceBoardColumn, command: TaskPlacement) {
  const { placement, statusId } = command.request;
  const tasks = column.tasks.filter((task) => task.id !== command.taskId);
  if (!('edge' in placement)) {
    const anchor = 'beforeId' in placement ? placement.beforeId : placement.afterId;
    const index = tasks.findIndex((task) => task.id === anchor && task.statusId === statusId);

    return index < 0 ? null : index + ('afterId' in placement ? 1 : 0);
  }

  const rank = column.statuses.findIndex((status) => status.id === statusId);
  if (rank < 0) return null;

  if (placement.edge === 'end' && column.nextCursor) return null;

  const index = tasks.findIndex((task) => {
    const taskRank = column.statuses.findIndex((status) => status.id === task.statusId);

    return placement.edge === 'start' ? taskRank >= rank : taskRank > rank;
  });

  return index < 0 ? tasks.length : index;
}

/** Derive previews from pending commands, never overwrite cached server snapshots. */
export function projectWorkspaceMoves(
  columns: readonly WorkspaceBoardColumn[],
  pending: readonly TaskPlacement[],
): readonly WorkspaceBoardColumn[] {
  return pending.reduce((current, command) => {
    const source = current.find((column) => column.list.id === command.sourceListId);
    const destination = current.find(
      (column) => column.list.id === command.request.destinationListId,
    );
    const task = source?.tasks.find((item) => item.id === command.taskId);
    if (
      !source ||
      !destination ||
      !task ||
      task.version !== command.request.expectedVersion ||
      task.statusId !== command.sourceStatusId ||
      source.configVersion !== command.request.expectedConfigVersion ||
      destination.configVersion !== command.request.expectedConfigVersion
    )
      return current;

    const index = previewIndex(destination, command);
    if (index === null) return current;

    const prepared = prepareMoveFields(
      task.customFields,
      destination.fields,
      command.request.customFields ?? {},
    );
    if (!prepared.success) return current;

    return current.map((column) => {
      if (column !== source && column !== destination) return column;

      const tasks = column.tasks.filter((item) => item.id !== task.id);
      if (column === destination)
        tasks.splice(index, 0, {
          ...task,
          primaryListId: destination.list.id,
          statusId: command.request.statusId,
          customFields: prepared.values,
        });

      return { ...column, tasks };
    });
  }, columns);
}
