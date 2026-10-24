// Contract-valid table fixtures, isolated from runtime and real database tests.
import { field, ids, task } from './board-fixture.mjs';

export const mobileOption = '30000000-0000-4000-8000-000000000a02';

export function tableFields(node) {
  const scope = (definition, ownerType, ownerId) => ({
    ...definition,
    workspaceId: node.workspaceId,
    ownerType,
    ownerId,
    isInherited: ownerType !== 'list',
    source: { ...definition.source, ownerType, ownerId },
  });
  const area = field('area', 'single_select', true, 1);
  const options = [...area.options, { id: mobileOption, label: 'Mobile', color: '#7357CC' }];

  return [
    scope({ ...field('effort', 'number'), name: 'Effort' }, 'workspace', node.workspaceId),
    scope({ ...area, name: 'Area', options }, 'folder', node.parentId),
    scope({ ...field('approved', 'checkbox', false, 2), name: 'Approved' }, 'list', node.id),
    scope(
      { ...field('tags', 'multi_select', false, 3), name: 'Tags', options },
      'folder',
      node.parentId,
    ),
  ];
}

export function tableTasks(node, session) {
  const offset =
    node.visibility === 'private'
      ? 100
      : node.workspaceId === session.data.activeWorkspace.id
        ? 0
        : 200;

  return [
    ['Plan release', 'normal', '2026-11-02', 0, ids.option, false, [ids.option]],
    ['Fix login', 'urgent', '2026-11-01', 5, mobileOption, true, [mobileOption]],
    ['Review scope', 'high', '2026-11-01', 3, ids.option, false, [ids.option, mobileOption]],
    ['Unscheduled work', 'low', null, 8, ids.option, true, []],
    ['Archive notes', 'none', null, 0, mobileOption, false, [ids.option, mobileOption]],
  ].map(([title, priority, dueDate, effort, area, approved, tags], index) =>
    task(offset + index + 1, index === 1 ? ids.active : ids.todo, index, {
      title: node.visibility === 'private' ? `Private ${title}` : title,
      priority,
      dueDate,
      workspaceId: node.workspaceId,
      primaryListId: node.id,
      assigneeIds: [session.data.user.id],
      assignees: [{ id: session.data.user.id, name: session.data.user.name }],
      customFields: { effort, area, approved, tags },
    }),
  );
}

export function sortedTableRows(items, query, statuses) {
  const ranks = { high: 1, low: 3, none: 4, normal: 2, urgent: 0 };
  const compare = (left, right) => {
    if (query.sort === 'dueDate') {
      if (left.dueDate === null && right.dueDate !== null) return 1;

      if (right.dueDate === null && left.dueDate !== null) return -1;

      const result = (left.dueDate ?? '').localeCompare(right.dueDate ?? '');

      return (query.direction === 'asc' ? result : -result) || left.id.localeCompare(right.id);
    }

    if (query.sort === 'priority') {
      const result = ranks[left.priority] - ranks[right.priority];

      return (query.direction === 'asc' ? result : -result) || left.id.localeCompare(right.id);
    }

    return (
      statuses.findIndex((item) => item.id === left.statusId) -
        statuses.findIndex((item) => item.id === right.statusId) ||
      left.position - right.position ||
      left.id.localeCompare(right.id)
    );
  };
  const rawValue = query.fieldKey ? JSON.parse(query.fieldValue) : undefined;
  const value =
    typeof rawValue === 'string' && ['area', 'tags'].includes(query.fieldKey)
      ? rawValue.toLowerCase()
      : rawValue;

  return items
    .filter(
      (item) =>
        !query.fieldKey ||
        (query.fieldOperator === 'contains'
          ? item.customFields[query.fieldKey]?.includes(value)
          : item.customFields[query.fieldKey] === value),
    )
    .toSorted(compare);
}
