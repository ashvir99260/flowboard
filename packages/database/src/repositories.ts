import {
  ContainerTypeSchema,
  NameSchema,
  PermissionModeSchema,
  UuidSchema,
  VisibilitySchema,
} from '@flowboard/contracts';

import { accessRepository } from './access-repository.js';
import { activityRepository } from './activity-repository.js';
import { fieldRepository } from './field-repository.js';
import { hierarchyRepository } from './hierarchy-repository.js';
import { membershipRepository } from './membership-repository.js';
import { scopeRepository } from './scope-repository.js';
import { statusRepository } from './status-repository.js';
import { taskRepository } from './task-repository.js';
import { DatabaseError, exactKeys } from './tenant-context.js';

import type { Prisma } from './generated/client.js';
import type { TenantContext } from './tenant-context.js';
import type {
  ContainerType,
  PermissionMode,
  Visibility,
  WorkspaceRole,
} from '@flowboard/contracts';

export interface NodeRecord {
  archivedAt: Date | null;
  createdAt: Date;
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  type: ContainerType;
  updatedAt: Date;
  version: number;
  visibility: Visibility;
  workspaceId: string;
}

export interface MembershipRecord {
  createdAt: Date;
  role: WorkspaceRole;
  updatedAt: Date;
  userId: string;
  workspaceId: string;
}

export interface ChildrenQuery {
  afterId?: string;
  limit?: number;
  parentId: string | null;
}

export interface NewNode {
  name: string;
  parentId: string | null;
  type: ContainerType;
  visibility?: Visibility;
}

export interface GrantInput {
  mode: PermissionMode;
  resourceId: string;
  userId: string;
}

export interface NodeReader {
  children(query: ChildrenQuery): Promise<NodeRecord[]>;
  countChildren(parentId: string | null): Promise<number>;
  find(id: string): Promise<NodeRecord | null>;
  path(id: string): Promise<NodeRecord[] | null>;
}

export interface NodeWriter extends NodeReader {
  create(input: NewNode): Promise<NodeRecord>;
  rename(id: string, name: string): Promise<NodeRecord>;
}

export interface GrantRecord extends GrantInput {
  createdAt: Date;
  updatedAt: Date;
  workspaceId: string;
}

export interface ReadRepositories {
  activities: ReturnType<typeof activityRepository>;
  tasks: ReturnType<typeof taskRepository>['read'];
  access: ReturnType<typeof accessRepository>['read'];
  context: Readonly<TenantContext>;
  scopes: ReturnType<typeof scopeRepository>;
  fields: ReturnType<typeof fieldRepository>['read'];
  statuses: ReturnType<typeof statusRepository>['read'];
  grants: { find(resourceId: string, userId: string): Promise<GrantRecord | null> };
  members: { find(userId: string): Promise<MembershipRecord | null> };
  memberships: ReturnType<typeof membershipRepository>['read'];
  nodes: NodeReader;
  hierarchy: ReturnType<typeof hierarchyRepository>['read'];
}

export interface WriteRepositories extends ReadRepositories {
  tasks: ReturnType<typeof taskRepository>['write'];
  fields: ReturnType<typeof fieldRepository>['write'];
  statuses: ReturnType<typeof statusRepository>['write'];
  access: ReturnType<typeof accessRepository>['write'];
  memberships: ReturnType<typeof membershipRepository>['write'];
  grants: ReadRepositories['grants'] & {
    remove(resourceId: string, userId: string): Promise<void>;
    set(input: GrantInput): Promise<GrantRecord>;
  };
  nodes: NodeWriter;
  hierarchy: ReturnType<typeof hierarchyRepository>['write'];
}

// All selectors add the transaction's workspace. No Prisma where/data/include
// input crosses this boundary; clients get no unrestricted query capability.
export function repositories(
  tx: Prisma.TransactionClient,
  context: TenantContext,
  assertActive: () => void,
) {
  const { workspaceId } = context;
  const nodeWhere = (id: string) => ({ archivedAt: null, id: UuidSchema.parse(id), workspaceId });
  const memberWhere = (userId: string) => ({ userId: UuidSchema.parse(userId), workspaceId });

  async function nodePath(id: string): Promise<NodeRecord[] | null> {
    assertActive();
    const path: NodeRecord[] = [];
    const seen = new Set<string>();
    let currentId: string | null = id.toLowerCase();
    while (currentId) {
      if (seen.has(currentId)) return null;

      seen.add(currentId);
      const record: NodeRecord | null = await tx.node.findFirst({ where: nodeWhere(currentId) });
      if (!record) return null;

      path.unshift(record);
      currentId = record.parentId;
    }

    return path;
  }

  async function node(id: string) {
    return (await nodePath(id))?.at(-1) ?? null;
  }

  async function requireNode(id: string) {
    const result = await node(id);
    if (!result) throw new DatabaseError('NOT_FOUND', 'Container not found');

    return result;
  }

  async function member(userId: string) {
    assertActive();

    return tx.membership.findFirst({ where: memberWhere(userId) });
  }

  async function parentWhere(parentId: string | null) {
    assertActive();
    const parent = parentId === null ? null : await requireNode(parentId);

    return { archivedAt: null, parentId: parent?.id ?? null, workspaceId };
  }

  async function grantWhere(resourceId: string, userId: string) {
    assertActive();
    await requireNode(resourceId);
    if (!(await member(userId))) throw new DatabaseError('NOT_FOUND', 'Member not found');

    return { resourceId, userId, workspaceId };
  }

  const nodes: NodeWriter = Object.freeze({
    async children(query: ChildrenQuery) {
      exactKeys(query, ['parentId', 'afterId', 'limit']);
      const where = await parentWhere(query.parentId);
      const limit = query.limit === undefined ? 50 : query.limit;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        throw new DatabaseError('VALIDATION_FAILED', 'Limit must be between 1 and 100');
      }

      if (query.afterId !== undefined) {
        const anchor = await requireNode(query.afterId);
        if (anchor.parentId !== where.parentId)
          throw new DatabaseError('INVALID_CURSOR', 'Cursor parent does not match');
      }

      // Internal keyset page only. Public cursors are signed by the API layer.
      return tx.node.findMany({
        ...(query.afterId ? { cursor: { id: query.afterId }, skip: 1 } : {}),
        orderBy: { id: 'asc' },
        take: limit,
        where,
      });
    },
    async countChildren(parentId: string | null) {
      return tx.node.count({ where: await parentWhere(parentId) });
    },
    async create(input: NewNode) {
      assertActive();
      exactKeys(input, ['name', 'parentId', 'type', 'visibility']);
      const type = ContainerTypeSchema.parse(input.type);
      const parent = input.parentId === null ? null : await requireNode(input.parentId);
      if (
        (type === 'space' && parent) ||
        (type === 'folder' && parent?.type !== 'space') ||
        (type === 'list' && parent?.type !== 'folder')
      ) {
        throw new DatabaseError('INVALID_PARENT', 'Container parent does not match its type');
      }

      return tx.node.create({
        data: {
          name: NameSchema.parse(input.name),
          parentId: parent?.id ?? null,
          type,
          visibility: VisibilitySchema.parse(
            input.visibility === undefined ? 'public' : input.visibility,
          ),
          workspaceId,
        },
      });
    },
    find: node,
    path: nodePath,
    async rename(id: string, name: string) {
      await requireNode(id);

      return tx.node.update({
        data: { name: NameSchema.parse(name) },
        where: { workspaceId_id: { id, workspaceId } },
      });
    },
  });

  const grants: WriteRepositories['grants'] = Object.freeze({
    async find(resourceId: string, userId: string) {
      return tx.grant.findFirst({ where: await grantWhere(resourceId, userId) });
    },
    async remove(resourceId: string, userId: string) {
      const where = await grantWhere(resourceId, userId);
      await tx.grant.deleteMany({ where });
    },
    async set(input: GrantInput) {
      exactKeys(input, ['resourceId', 'userId', 'mode']);
      const where = await grantWhere(input.resourceId, input.userId);
      const mode = PermissionModeSchema.parse(input.mode);

      return tx.grant.upsert({
        create: { ...where, mode },
        update: { mode },
        where: { workspaceId_resourceId_userId: where },
      });
    },
  });

  const scopes = scopeRepository(tx, context, assertActive, nodePath);
  const fields = fieldRepository(tx, context, scopes);
  const statuses = statusRepository(tx, context, assertActive, nodePath);
  const access = accessRepository(tx, context, assertActive, node);
  const tasks = taskRepository(
    tx,
    context,
    scopes,
    assertActive,
    statuses.read,
    fields.read,
    access.read,
  );

  const hierarchy = hierarchyRepository(tx, context, assertActive, node, async (moved) => {
    const owner = { ownerType: moved.type, ownerId: moved.id };
    await statuses.validate(owner);
    await fields.validate(owner, false);
    const paths = await scopes.affectedPaths(owner);
    const lists = paths.map((path) => path.at(-1)!).filter((scope) => scope.ownerType === 'list');
    for (const list of lists) {
      const allowed = new Set(await access.read.assignableMemberIds(list.ownerId));
      const assigned = await tx.taskAssignee.findMany({
        where: {
          workspaceId,
          task: { workspaceId, primaryListId: list.ownerId, archivedAt: null },
        },
        select: { userId: true },
      });
      if (assigned.some((assignment) => !allowed.has(assignment.userId)))
        throw new DatabaseError(
          'CONFIG_INVALIDATES_TASKS',
          'Container move would revoke assignee access',
          [
            {
              code: 'forbidden_assignee',
              path: ['assigneeIds'],
              message: 'A descendant task is assigned to a member without destination access',
            },
          ],
        );
    }
  });

  return {
    read: Object.freeze({
      activities: activityRepository(tx, context, assertActive),
      scopes,
      tasks: tasks.read,
      fields: fields.read,
      access: access.read,
      context: Object.freeze(context),
      statuses: statuses.read,
      grants: Object.freeze({ find: grants.find }),
      members: Object.freeze({ find: member }),
      memberships: membershipRepository(tx, context, assertActive, access.read.assignableMemberIds)
        .read,
      hierarchy: hierarchy.read,
      nodes: Object.freeze({
        children: nodes.children,
        countChildren: nodes.countChildren,
        find: node,
        path: nodePath,
      }),
    }) satisfies ReadRepositories,
    write: Object.freeze({
      activities: activityRepository(tx, context, assertActive),
      scopes,
      tasks: tasks.write,
      fields: fields.write,
      access: access.write,
      context: Object.freeze(context),
      statuses: statuses.write,
      grants,
      members: Object.freeze({ find: member }),
      memberships: membershipRepository(tx, context, assertActive, access.read.assignableMemberIds)
        .write,
      nodes,
      hierarchy: hierarchy.write,
    }) satisfies WriteRepositories,
  };
}
