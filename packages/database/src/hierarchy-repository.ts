import { randomUUID } from 'node:crypto';

import {
  ContainerParentType,
  CreateNodeSchema,
  NodeUpdatedEventSchema,
  NodeVersionSchema,
  TaskUpdatedEventSchema,
  UpdateNodeSchema,
} from '@flowboard/contracts';

import { DatabaseError } from './tenant-context.js';
import { recordWorkspaceChange } from './workspace-events.js';

import type { Prisma } from './generated/client.js';
import type { NodeRecord } from './repositories.js';
import type { TenantContext } from './tenant-context.js';
import type { CreateNode, NodeVersion, UpdateNode } from '@flowboard/contracts';

export interface NodeSnapshot {
  configVersion: number;
  dataVersion: number;
  node: NodeRecord;
}

export function hierarchyRepository(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  assertActive: () => void,
  findNode: (id: string) => Promise<NodeRecord | null>,
) {
  const { workspaceId, actorUserId } = context;
  async function versions() {
    assertActive();

    return tx.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { configVersion: true, dataVersion: true },
    });
  }
  async function checkConfig(expected: number) {
    const current = await versions();
    if (current.configVersion !== expected)
      throw new DatabaseError('CONFIG_CONFLICT', 'Workspace configuration changed');

    return current;
  }
  async function emitNode(node: NodeRecord, operation: 'created' | 'updated' | 'archived') {
    const id = randomUUID();
    const payload = NodeUpdatedEventSchema.parse({
      eventId: id,
      workspaceId,
      actorId: actorUserId,
      schemaVersion: 1,
      occurredAt: node.updatedAt.toISOString(),
      nodeId: node.id,
      nodeVersion: node.version,
      operation,
    });
    await tx.outboxEvent.create({
      data: {
        id,
        workspaceId,
        actorId: actorUserId,
        aggregateType: 'node',
        aggregateId: node.id,
        aggregateVersion: node.version,
        eventType: 'node.updated',
        payload,
      },
    });
  }
  const read = Object.freeze({
    async find(id: string): Promise<NodeSnapshot | null> {
      const node = await findNode(id);

      return node ? { node, ...(await versions()) } : null;
    },
  });
  const write = Object.freeze({
    ...read,
    async archive(id: string, input: NodeVersion): Promise<void> {
      const data = NodeVersionSchema.parse(input);
      const node = await findNode(id);
      if (!node) throw new DatabaseError('NOT_FOUND', 'Container not found');

      await checkConfig(data.expectedConfigVersion);
      if (node.version !== data.expectedVersion)
        throw new DatabaseError('VERSION_CONFLICT', 'Container version changed');

      const descendants: NodeRecord[] = [node];
      const visited = new Set([node.id]);
      let frontier = [node.id];
      while (frontier.length) {
        const children = await tx.node.findMany({
          where: { workspaceId, parentId: { in: frontier } },
        });
        const unseen = children.filter((child) => !visited.has(child.id));
        for (const child of unseen) visited.add(child.id);
        descendants.push(...unseen);
        frontier = unseen.map((child) => child.id);
      }
      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp()::timestamptz(3) AS now`;
      if (!clock) throw new Error('Database clock unavailable');

      for (const descendant of descendants.filter((item) => item.archivedAt === null)) {
        const updated = await tx.node.update({
          where: { workspaceId_id: { workspaceId, id: descendant.id } },
          data: { archivedAt: clock.now, version: { increment: 1 } },
        });
        await emitNode(updated, 'archived');
      }
      const lists = descendants.filter((item) => item.type === 'list').map((item) => item.id);
      const tasks = await tx.task.findMany({
        where: { workspaceId, primaryListId: { in: lists }, archivedAt: null },
        select: { id: true, primaryListId: true },
      });
      for (const task of tasks) {
        const updated = await tx.task.update({
          where: { workspaceId_id: { workspaceId, id: task.id } },
          data: { archivedAt: clock.now, version: { increment: 1 } },
          select: { updatedAt: true, version: true },
        });
        const eventId = randomUUID();
        const payload = TaskUpdatedEventSchema.parse({
          eventId,
          workspaceId,
          actorId: actorUserId,
          schemaVersion: 1,
          occurredAt: updated.updatedAt.toISOString(),
          taskId: task.id,
          taskVersion: updated.version,
          previousListId: task.primaryListId,
          currentListId: task.primaryListId,
          changes: { archivedAt: { before: null, after: clock.now.toISOString() } },
        });
        await tx.outboxEvent.create({
          data: {
            id: eventId,
            workspaceId,
            actorId: actorUserId,
            aggregateType: 'task',
            aggregateId: task.id,
            aggregateVersion: updated.version,
            eventType: 'task.updated',
            payload,
          },
        });
      }
      await recordWorkspaceChange(tx, workspaceId, actorUserId, 'hierarchy', true);
    },
    async update(id: string, input: UpdateNode): Promise<NodeSnapshot> {
      const data = UpdateNodeSchema.parse(input);
      const node = await findNode(id);
      if (!node) throw new DatabaseError('NOT_FOUND', 'Container not found');

      const current = await checkConfig(data.expectedConfigVersion);
      if (node.version !== data.expectedVersion)
        throw new DatabaseError('VERSION_CONFLICT', 'Container version changed');

      const name = data.name ?? node.name;
      const visibility = data.visibility ?? node.visibility;
      if (name === node.name && visibility === node.visibility) return { node, ...current };

      const changed = await tx.node.update({
        where: { workspaceId_id: { workspaceId, id: node.id } },
        data: { name, visibility, version: { increment: 1 } },
      });
      await emitNode(changed, 'updated');
      const revisions = await recordWorkspaceChange(
        tx,
        workspaceId,
        actorUserId,
        'hierarchy',
        true,
      );

      return { node: changed, ...revisions };
    },
    async create(input: CreateNode): Promise<NodeSnapshot> {
      assertActive();
      const data = CreateNodeSchema.parse(input);
      await checkConfig(data.expectedConfigVersion);
      const parent = data.parentId === null ? null : await findNode(data.parentId);
      if (data.parentId !== null && !parent)
        throw new DatabaseError('NOT_FOUND', 'Container not found');

      if ((parent?.type ?? null) !== ContainerParentType[data.type])
        throw new DatabaseError('INVALID_PARENT', 'Container parent does not match its type');

      const { _max } = await tx.node.aggregate({
        where: { workspaceId, parentId: parent?.id ?? null, archivedAt: null },
        _max: { position: true },
      });
      const position = (_max.position ?? -1) + 1;
      if (position > 2_147_483_647)
        throw new DatabaseError('VALIDATION_FAILED', 'Sibling position capacity exceeded');

      const [clock] = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp()::timestamptz(3) AS now`;
      if (!clock) throw new Error('Database clock unavailable');

      const node = await tx.node.create({
        data: {
          workspaceId,
          name: data.name,
          type: data.type,
          parentId: parent?.id ?? null,
          visibility: data.visibility,
          position,
          createdAt: clock.now,
          updatedAt: clock.now,
        },
      });
      await emitNode(node, 'created');
      const revisions = await recordWorkspaceChange(
        tx,
        workspaceId,
        actorUserId,
        'hierarchy',
        true,
      );

      return { node, ...revisions };
    },
  });

  return { read, write };
}
