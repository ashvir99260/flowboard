// Schema-valid HTTP fixtures for client assembly/race tests, never runtime data.
import {
  AuthExamples,
  ResolvedFieldSchema,
  ResolvedStatusSchema,
  TaskSchema,
} from '@flowboard/contracts';

export const workspaceId = AuthExamples.session.data.activeWorkspace.id;

export const listId = '20000000-0000-4000-8000-000000000013';

export const ids = {
  active: '30000000-0000-4000-8000-000000000102',
  closed: '30000000-0000-4000-8000-000000000104',
  done: '30000000-0000-4000-8000-000000000103',
  option: '30000000-0000-4000-8000-000000000501',
  todo: '30000000-0000-4000-8000-000000000101',
};

export function status(id, key, category, position, name = key) {
  return ResolvedStatusSchema.parse({
    ...ResolvedStatusSchema.meta().example,
    id,
    key,
    category,
    position,
    name,
    workspaceId,
    sourceOwner: { ownerType: 'workspace', ownerId: workspaceId },
  });
}

export function field(key, type, required = false, position = 0) {
  const id = `40000000-0000-4000-8000-${String(position + 1).padStart(12, '0')}`;

  return ResolvedFieldSchema.parse({
    ...ResolvedFieldSchema.meta().example,
    id,
    workspaceId,
    ownerId: workspaceId,
    key,
    name: key,
    type,
    required,
    position,
    source: { ...ResolvedFieldSchema.meta().example.source, fieldId: id, ownerId: workspaceId },
    options: type === 'single_select' ? [{ id: ids.option, label: 'Web', color: '#2563EB' }] : [],
  });
}

export function task(suffix, statusId = ids.todo, position = 0, overrides = {}) {
  return TaskSchema.parse({
    ...TaskSchema.meta().example,
    id: `50000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`,
    workspaceId,
    primaryListId: listId,
    statusId,
    position,
    customFields: { effort: 0, area: ids.option },
    ...overrides,
  });
}

export function page(statusId, items = [], cursor, nextCursor = null, versions = {}) {
  return {
    request: { statusId, ...(cursor ? { cursor } : {}) },
    response: {
      items,
      pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
      configVersion: 1,
      dataVersion: 1,
      ...versions,
    },
  };
}

export function boardFixture() {
  return {
    workspaceId,
    listId,
    statuses: {
      configVersion: 1,
      items: [
        status(ids.todo, 'todo', 'not_started', 0, 'To do'),
        status(ids.active, 'active', 'active', 1, 'In progress'),
        status(ids.done, 'done', 'done', 2, 'Done'),
      ],
    },
    fields: {
      configVersion: 1,
      items: [field('effort', 'number'), field('area', 'single_select', true, 1)],
    },
    pages: [
      page(ids.todo, [task(1), task(2, ids.todo, 7)]),
      page(ids.active, [
        task(3, ids.active, 0, {
          priority: 'high',
          dueDate: '2026-10-28',
          assigneeIds: [AuthExamples.session.data.user.id],
          assignees: [AuthExamples.session.data.user].map(({ id, name }) => ({ id, name })),
        }),
      ]),
      page(ids.done),
    ],
  };
}
