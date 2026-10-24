import { FieldPatchSchema } from './field-values.js';
import { PlacementSchema } from './ordering.js';
import { ArchiveTaskSchema } from './task-mutations.js';
import { TaskSchema } from './tasks.js';

import type { ResolvedStatus } from './statuses.js';
import type { z } from 'zod';

export const ReorderTaskSchema = ArchiveTaskSchema.extend({ placement: PlacementSchema }).meta({
  title: 'Reorder task request',
  description: 'Place a task within its current list and status column using current revisions.',
  example: { expectedVersion: 1, expectedConfigVersion: 1, placement: { edge: 'end' } },
});

export const MoveTaskSchema = ReorderTaskSchema.extend({
  destinationListId: TaskSchema.shape.primaryListId.meta({
    title: 'Destination list ID',
    description: 'Visible live list receiving this task.',
    example: TaskSchema.shape.primaryListId.meta()?.example,
  }),
  statusId: TaskSchema.shape.statusId.optional(),
  customFields: FieldPatchSchema.optional(),
}).meta({
  title: 'Move task request',
  description:
    'Move to a visible list and valid status, applying explicit field corrections before validation.',
  example: {
    ...(ReorderTaskSchema.meta()?.example as object),
    destinationListId: TaskSchema.shape.primaryListId.meta()?.example,
  },
});

export function selectTaskStatus(
  source: Pick<ResolvedStatus, 'id' | 'category'>,
  destination: readonly Pick<ResolvedStatus, 'id' | 'key' | 'category' | 'position'>[],
  explicit?: string,
): { statusId: string; success: true } | { success: false } {
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const selected = explicit
    ? destination.find((status) => status.id === explicit)
    : (destination.find((status) => status.id === source.id) ??
      [...destination]
        .sort((a, b) => a.position - b.position || compare(a.key, b.key) || compare(a.id, b.id))
        .find((status) => status.category === source.category));

  return selected ? { success: true, statusId: selected.id } : { success: false };
}

export type MoveTask = z.infer<typeof MoveTaskSchema>;

export type ReorderTask = z.infer<typeof ReorderTaskSchema>;
