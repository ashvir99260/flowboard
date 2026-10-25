import { CustomFieldOptionSchema } from '@flowboard/contracts';

import { createClient } from './client.js';
import { hashPassword } from './password.js';
import { demoId as id, OperationsAccounts, seedOperations } from './seed-operations.js';

import type { Prisma } from './generated/client.js';
import type { Priority } from '@flowboard/contracts';

const version = 'demo-v1';
// Intentionally public local-demo credentials; hosted deployments leave DEMO_SEED off.
export const DemoPassword = 'FlowboardDemo123!';

export const DemoAccounts = Object.freeze([
  { email: 'alice@example.com', id: id(101), name: 'Alice' },
  { email: 'bob@example.com', id: id(102), name: 'Bob' },
  { email: 'carol@example.com', id: id(103), name: 'Carol' },
  { email: 'dan@example.com', id: id(104), name: 'Dan' },
  ...OperationsAccounts,
]);

export async function seedDemoData(databaseUrl: string): Promise<boolean> {
  const client = createClient(databaseUrl);
  try {
    return await client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(706270, 1)::text`;
        if (await tx.seedState.findUnique({ where: { version } })) return false;

        for (const account of DemoAccounts) {
          await tx.user.create({
            data: { ...account, passwordHash: await hashPassword(DemoPassword) },
          });
        }
        await mainWorkspace(tx);
        await seedOperations(tx, id(1));
        await otherWorkspace(tx);
        await tx.seedState.create({ data: { version } });

        return true;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
  } finally {
    await client.$disconnect();
  }
}

async function mainWorkspace(tx: Prisma.TransactionClient) {
  const workspaceId = id(1);
  await tx.workspace.create({ data: { id: workspaceId, name: 'Flowboard Demo' } });
  for (const [index, role] of ['admin', 'member', 'member'].entries()) {
    await tx.membership.create({
      data: { role: role as 'admin' | 'member', userId: id(101 + index), workspaceId },
    });
  }
  for (const node of [
    { id: id(201), name: 'Engineering', parentId: null, type: 'space' },
    { id: id(202), name: 'Design', parentId: null, type: 'space' },
    { id: id(211), name: 'Delivery', parentId: id(201), type: 'folder' },
    { id: id(212), name: 'Research', parentId: id(202), type: 'folder' },
    { id: id(221), name: 'Product backlog', parentId: id(211), type: 'list' },
    { id: id(222), name: 'Private launch', parentId: id(211), type: 'list', visibility: 'private' },
    { id: id(223), name: 'Discovery', parentId: id(212), type: 'list' },
  ] as const) {
    await tx.node.create({ data: { ...node, workspaceId } });
  }
  await tx.grant.createMany({
    data: [
      { mode: 'allow', resourceId: id(222), userId: id(103), workspaceId },
      { mode: 'deny', resourceId: id(223), userId: id(102), workspaceId },
    ],
  });
  await statuses(tx, workspaceId, 400);
  await tx.statusIdentity.create({
    data: { category: 'active', id: id(405), key: 'blocked', workspaceId },
  });
  await tx.statusOverride.createMany({
    data: [
      {
        color: '#D97706',
        id: id(505),
        name: 'In review',
        ownerId: id(222),
        ownerType: 'list',
        position: 1,
        statusId: id(401),
        workspaceId,
      },
      {
        color: '#DC2626',
        id: id(506),
        name: 'Blocked',
        ownerId: id(222),
        ownerType: 'list',
        position: 2,
        statusId: id(405),
        workspaceId,
      },
      {
        hidden: true,
        id: id(507),
        ownerId: id(223),
        ownerType: 'list',
        statusId: id(403),
        workspaceId,
      },
    ],
  });
  const option = (optionId: string, label: string, color: string) =>
    CustomFieldOptionSchema.parse({
      color,
      id: optionId,
      label,
    });
  await tx.fieldDefinition.createMany({
    data: [
      {
        id: id(601),
        key: 'effort',
        name: 'Effort',
        ownerId: workspaceId,
        ownerType: 'workspace',
        required: true,
        type: 'number',
        workspaceId,
      },
      {
        id: id(602),
        key: 'team',
        name: 'Team',
        options: [option(id(610), 'Frontend', '#2563EB'), option(id(611), 'Backend', '#059669')],
        ownerId: id(201),
        ownerType: 'space',
        type: 'single_select',
        workspaceId,
      },
      {
        id: id(603),
        key: 'release_date',
        name: 'Release date',
        ownerId: id(211),
        ownerType: 'folder',
        type: 'date',
        workspaceId,
      },
      {
        id: id(609),
        key: 'customer',
        name: 'Research customer',
        ownerId: id(202),
        ownerType: 'space',
        type: 'text',
        workspaceId,
      },
      {
        id: id(604),
        key: 'team',
        name: 'Launch team',
        options: [option(id(612), 'Design', '#7C3AED'), option(id(613), 'Platform', '#D97706')],
        ownerId: id(222),
        ownerType: 'list',
        type: 'single_select',
        workspaceId,
      },
    ],
  });
  const priorities: Priority[] = ['urgent', 'high', 'normal', 'low', 'none'];
  for (let index = 0; index < 24; index += 1) {
    const list = Math.floor(index / 8);
    const choices =
      list === 1 ? [400, 401, 402, 405] : list === 2 ? [400, 401, 402] : [400, 401, 402, 403];
    const customFields: Record<string, string | number> = { effort: (index % 8) + 1 };
    if (list === 0) customFields['team'] = id(index % 2 ? 610 : 611);

    if (list === 1) customFields['team'] = id(index % 2 ? 612 : 613);

    if (list < 2 && index % 2 === 0) customFields['release_date'] = '2026-11-20';

    const taskId = id(700 + index);
    await tx.task.create({
      data: {
        customFields,
        description: `## Demo task\n\nExplore a real workflow for task ${index + 1}.`,
        dueDate:
          index % 3
            ? new Date(`2026-11-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`)
            : null,
        id: taskId,
        position: index % 8,
        primaryListId: id(221 + list),
        priority: priorities[index % priorities.length]!,
        statusId: id(choices[index % choices.length]!),
        title: ['Build', 'Review', 'Document', 'Test'][index % 4] + ` demo workflow ${index + 1}`,
        workspaceId,
      },
    });
    await tx.taskAssignee.create({
      data: {
        taskId,
        userId: list === 0 && index % 2 ? id(102) : list > 0 ? id(103) : id(101),
        workspaceId,
      },
    });
  }
}

async function statuses(tx: Prisma.TransactionClient, workspaceId: string, start: number) {
  const entries = [
    { category: 'not_started', color: '#64748B', key: 'todo', name: 'To do' },
    { category: 'active', color: '#2563EB', key: 'doing', name: 'In progress' },
    { category: 'done', color: '#059669', key: 'done', name: 'Done' },
    { category: 'closed', color: '#475569', key: 'closed', name: 'Closed' },
  ] as const;
  for (const [position, value] of entries.entries()) {
    const statusId = id(start + position);
    await tx.statusIdentity.create({
      data: { category: value.category, id: statusId, key: value.key, workspaceId },
    });
    await tx.statusOverride.create({
      data: {
        color: value.color,
        id: id(start + 100 + position),
        name: value.name,
        ownerId: workspaceId,
        ownerType: 'workspace',
        position,
        statusId,
        workspaceId,
      },
    });
  }
}

async function otherWorkspace(tx: Prisma.TransactionClient) {
  const workspaceId = id(2);
  await tx.workspace.create({ data: { id: workspaceId, name: 'Other Tenant' } });
  await tx.membership.createMany({
    data: [
      { role: 'admin', userId: id(104), workspaceId },
      { role: 'member', userId: id(101), workspaceId },
    ],
  });
  await tx.node.createMany({
    data: [
      { id: id(301), name: 'Other space', type: 'space', workspaceId },
      { id: id(311), name: 'Other folder', parentId: id(301), type: 'folder', workspaceId },
      { id: id(321), name: 'Other list', parentId: id(311), type: 'list', workspaceId },
    ],
  });
  await statuses(tx, workspaceId, 800);
  for (let index = 0; index < 3; index += 1) {
    await tx.task.create({
      data: {
        id: id(900 + index),
        position: index,
        primaryListId: id(321),
        statusId: id(800 + index),
        title: `Other tenant task ${index + 1}`,
        workspaceId,
      },
    });
  }
}
