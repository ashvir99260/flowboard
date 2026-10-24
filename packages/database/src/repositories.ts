import {
  ContainerTypeSchema,
  NameSchema,
  PermissionModeSchema,
  UuidSchema,
  VisibilitySchema,
} from '@flowboard/contracts';

import { accessRepository } from './access-repository.js';
import { hierarchyRepository } from './hierarchy-repository.js';
import { membershipRepository } from './membership-repository.js';
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
  access: ReturnType<typeof accessRepository>['read'];
  context: Readonly<TenantContext>;
  grants: { find(resourceId: string, userId: string): Promise<GrantRecord | null> };
  members: { find(userId: string): Promise<MembershipRecord | null> };
  memberships: ReturnType<typeof membershipRepository>['read'];
  nodes: NodeReader;
  hierarchy: ReturnType<typeof hierarchyRepository>['read'];
}

export interface WriteRepositories extends ReadRepositories {
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

  async function node(id: string) {
    assertActive();

    const record = await tx.node.findFirst({ where: nodeWhere(id) });
    let parentId = record?.parentId;
    const seen = new Set([id.toLowerCase()]);
    while (parentId) {
      if (seen.has(parentId)) return null;

      seen.add(parentId);
      const parent = await tx.node.findFirst({
        where: nodeWhere(parentId),
        select: { parentId: true },
      });
      if (!parent) return null;

      parentId = parent.parentId;
    }

    return record;
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

  return {
    read: Object.freeze({
      access: accessRepository(tx, context, assertActive, node).read,
      context: Object.freeze(context),
      grants: Object.freeze({ find: grants.find }),
      members: Object.freeze({ find: member }),
      memberships: membershipRepository(tx, context, assertActive).read,
      hierarchy: hierarchyRepository(tx, context, assertActive, node).read,
      nodes: Object.freeze({
        children: nodes.children,
        countChildren: nodes.countChildren,
        find: node,
      }),
    }) satisfies ReadRepositories,
    write: Object.freeze({
      access: accessRepository(tx, context, assertActive, node).write,
      context: Object.freeze(context),
      grants,
      members: Object.freeze({ find: member }),
      memberships: membershipRepository(tx, context, assertActive).write,
      nodes,
      hierarchy: hierarchyRepository(tx, context, assertActive, node).write,
    }) satisfies WriteRepositories,
  };
}
