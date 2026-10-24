import { applyTaskFieldPatch } from '@flowboard/contracts';

import type { BoardColumn } from './board-data';
import type { FieldValues, MoveTask, Placement, ResolvedField } from '@flowboard/contracts';

export interface TaskPlacement {
  readonly request: MoveTask & { statusId: string };
  readonly sourceListId: string;
  readonly sourceStatusId: string;
  readonly taskId: string;
}

function insertionIndex(column: BoardColumn, placement: Placement, taskId: string) {
  const tasks = column.tasks.filter((task) => task.id !== taskId);
  if ('edge' in placement)
    return placement.edge === 'start' ? 0 : column.nextCursor ? 'outside' : tasks.length;

  const anchor = 'beforeId' in placement ? placement.beforeId : placement.afterId;
  if (anchor === taskId) return null;

  const index = tasks.findIndex((task) => task.id === anchor);

  return index < 0 ? null : index + ('afterId' in placement ? 1 : 0);
}

function projectPlacement(columns: readonly BoardColumn[], listId: string, command: TaskPlacement) {
  const { request, taskId, sourceListId, sourceStatusId } = command;
  if (sourceListId !== listId) return columns;

  const task = columns.flatMap((column) => column.tasks).find((item) => item.id === taskId);
  if (!task || task.version !== request.expectedVersion || task.statusId !== sourceStatusId)
    return columns;

  const destination = columns.find(
    (column) => column.status.id === (request.statusId ?? sourceStatusId),
  );
  const sameList = request.destinationListId === listId;
  if (sameList && !destination) return columns;

  const index = destination ? insertionIndex(destination, request.placement, taskId) : 'outside';
  if (sameList && index === null) return columns;

  return columns.map((column) => {
    const tasks = column.tasks.filter((item) => item.id !== taskId);
    if (sameList && column === destination && typeof index === 'number')
      tasks.splice(index, 0, { ...task, statusId: column.status.id });

    return { ...column, tasks };
  });
}

export function projectPlacements(
  columns: readonly BoardColumn[],
  listId: string,
  commands: readonly TaskPlacement[],
): readonly BoardColumn[] {
  return commands.reduce((current, command) => projectPlacement(current, listId, command), columns);
}

export function prepareMoveFields(
  current: FieldValues,
  fields: readonly ResolvedField[],
  corrections: NonNullable<MoveTask['customFields']>,
) {
  const keys = new Set(fields.map((field) => field.key));
  const removedKeys = Object.keys(current).filter((key) => !keys.has(key));
  const patch = { ...Object.fromEntries(removedKeys.map((key) => [key, null])), ...corrections };

  return { ...applyTaskFieldPatch({ current, fields, patch }), patch, removedKeys };
}
