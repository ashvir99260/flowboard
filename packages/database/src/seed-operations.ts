import { CustomFieldOptionSchema } from '@flowboard/contracts';

import type { Prisma } from './generated/client.js';
import type { FieldValue, Priority } from '@flowboard/contracts';

export const demoId = (value: number) =>
  `f1000000-0000-4000-8000-${String(value).padStart(12, '0')}`;

export const OperationsAccounts = Object.freeze([
  { email: 'eve@example.com', id: demoId(105), name: 'Eve' },
  { email: 'frank@example.com', id: demoId(106), name: 'Frank' },
]);

/** Fresh-demo fixtures only; the seed orchestrator prevents writes to initialized databases. */
export async function seedOperations(tx: Prisma.TransactionClient, workspaceId: string) {
  const id = demoId;
  await tx.membership.createMany({
    data: OperationsAccounts.map((account) => ({
      role: 'member',
      userId: account.id,
      workspaceId,
    })),
  });
  await tx.node.createMany({
    data: [
      {
        id: id(203),
        name: 'Operations',
        parentId: null,
        position: 2,
        type: 'space',
        visibility: 'private',
        workspaceId,
      },
      {
        id: id(213),
        name: 'Customer support',
        parentId: id(203),
        position: 0,
        type: 'folder',
        workspaceId,
      },
      {
        id: id(214),
        name: 'Internal operations',
        parentId: id(203),
        position: 1,
        type: 'folder',
        workspaceId,
      },
      {
        id: id(224),
        name: 'Support triage',
        parentId: id(213),
        position: 0,
        type: 'list',
        visibility: 'private',
        workspaceId,
      },
      {
        id: id(225),
        name: 'Incident follow-up',
        parentId: id(213),
        position: 1,
        type: 'list',
        workspaceId,
      },
      {
        id: id(226),
        name: 'Routine operations',
        parentId: id(214),
        position: 0,
        type: 'list',
        workspaceId,
      },
    ],
  });
  await tx.grant.createMany({
    data: [
      { mode: 'allow', resourceId: id(203), userId: id(105), workspaceId },
      { mode: 'allow', resourceId: id(203), userId: id(106), workspaceId },
      { mode: 'allow', resourceId: id(224), userId: id(105), workspaceId },
      { mode: 'deny', resourceId: id(213), userId: id(106), workspaceId },
    ],
  });
  await tx.statusIdentity.create({
    data: { category: 'active', id: id(406), key: 'waiting', workspaceId },
  });
  await tx.statusOverride.createMany({
    data: [
      {
        id: id(520),
        ownerId: id(203),
        ownerType: 'space',
        statusId: id(406),
        name: 'Waiting on customer',
        color: '#B45309',
        position: 2,
        workspaceId,
      },
      {
        id: id(521),
        ownerId: id(203),
        ownerType: 'space',
        statusId: id(401),
        name: 'Working',
        workspaceId,
      },
      {
        id: id(522),
        ownerId: id(224),
        ownerType: 'list',
        statusId: id(400),
        name: 'Incoming',
        workspaceId,
      },
      {
        id: id(523),
        ownerId: id(225),
        ownerType: 'list',
        statusId: id(403),
        hidden: true,
        workspaceId,
      },
      {
        id: id(524),
        ownerId: id(226),
        ownerType: 'list',
        statusId: id(406),
        hidden: true,
        workspaceId,
      },
      {
        id: id(525),
        ownerId: id(203),
        ownerType: 'space',
        statusId: id(402),
        position: 3,
        workspaceId,
      },
      {
        id: id(526),
        ownerId: id(203),
        ownerType: 'space',
        statusId: id(403),
        position: 4,
        workspaceId,
      },
    ],
  });
  const option = (key: number, label: string, color: string) =>
    CustomFieldOptionSchema.parse({ id: id(key), label, color });
  await tx.fieldDefinition.createMany({
    data: [
      {
        id: id(605),
        key: 'customer',
        name: 'Customer',
        ownerId: id(203),
        ownerType: 'space',
        type: 'text',
        position: 1,
        workspaceId,
      },
      {
        id: id(606),
        key: 'tags',
        name: 'Tags',
        ownerId: id(203),
        ownerType: 'space',
        type: 'multi_select',
        options: [option(621, 'Feedback', '#7C3AED'), option(622, 'Bug', '#DC2626')],
        position: 2,
        workspaceId,
      },
      {
        id: id(607),
        key: 'severity',
        name: 'Severity',
        ownerId: id(213),
        ownerType: 'folder',
        type: 'single_select',
        required: true,
        options: [option(623, 'High', '#B91C1C'), option(624, 'Low', '#047857')],
        position: 3,
        workspaceId,
      },
      {
        id: id(608),
        key: 'verified',
        name: 'Verified',
        ownerId: id(226),
        ownerType: 'list',
        type: 'checkbox',
        position: 3,
        workspaceId,
      },
    ],
  });
  const titles = [
    [
      'Investigate sign-in timeout',
      'Clarify invoice export fields',
      'Reproduce mobile menu issue',
      'Confirm accessibility feedback',
      'Review duplicate notifications',
      'Answer onboarding question',
      'Check report timezone',
      'Publish support resolution',
    ],
    [
      'Write timeout incident review',
      'Verify retry monitoring',
      'Review alert routing',
      'Confirm queue recovery',
      'Document customer impact',
      'Track follow-up actions',
      'Validate rollback checklist',
      'Close incident communication',
    ],
    [
      'Review service health',
      'Rotate demo checklist owners',
      'Audit workspace access',
      'Update support handbook',
      'Verify backup checklist',
      'Review maintenance window',
      'Check release readiness',
      'Archive resolved requests',
    ],
  ];
  const priorities: Priority[] = ['urgent', 'high', 'normal', 'low', 'none'];
  for (const [listIndex, listTitles] of titles.entries()) {
    const statuses = listIndex === 2 ? [400, 401, 402, 403] : [400, 401, 406, 402];
    for (const [index, title] of listTitles.entries()) {
      const taskId = id(1000 + listIndex * 8 + index);
      const customFields: Record<string, FieldValue> = { effort: index % 5 };
      if (index % 3 !== 0) customFields['customer'] = ['Acme Demo', 'Northwind Demo'][index % 2]!;

      if (index % 3 === 1) customFields['tags'] = [id(621)];

      if (index % 3 === 2) customFields['tags'] = [id(621), id(622)];

      if (listIndex < 2) customFields['severity'] = id(index % 2 ? 624 : 623);

      if (listIndex === 2 && index < 6) customFields['verified'] = index % 2 === 0;

      await tx.task.create({
        data: {
          id: taskId,
          workspaceId,
          primaryListId: id(224 + listIndex),
          statusId: id(statuses[index % statuses.length]!),
          title: title!,
          description: `## Context\n\n${title} for the fictional Operations demo.\n\n- Record the outcome\n- Verify the next action`,
          priority: priorities[(index + listIndex) % priorities.length]!,
          position: Math.floor(index / statuses.length),
          dueDate:
            index % 3
              ? new Date(`2026-12-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`)
              : null,
          customFields: customFields as Prisma.InputJsonObject,
        },
      });
      if (index === 7) continue;

      const userIds = listIndex === 2 && index % 2 === 0 ? [id(105), id(106)] : [id(105)];
      await tx.taskAssignee.createMany({
        data: userIds.map((userId) => ({ taskId, userId, workspaceId })),
      });
    }
  }
}
