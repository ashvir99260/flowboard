import { compareTreePositions, resolveVisibleTree } from '@flowboard/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.ts';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.ts';

import { PermissionsRuntimeKey } from './permissions.runtime.ts';

import type { PermissionsRuntime } from './permissions.runtime.ts';
import type {
  Grant,
  GrantEnvelope,
  GrantPage,
  PermissionAction,
  StatusScope,
  TreePage,
  UpsertGrant,
  WorkspaceRole,
} from '@flowboard/contracts';
import type { IdentitySession, ReadRepositories } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export const ActiveWorkspaceKey = 'flowboard:active-workspace-permission';

export const PermissionActionKey = 'flowboard:permission-action';

export const NodePermissionKey = 'flowboard:node-permission';

export const TaskPermissionKey = 'flowboard:task-permission';

export const ScopePermissionKey = 'flowboard:scope-permission';

function presentGrant(
  grant: Omit<Grant, 'createdAt' | 'updatedAt'> & { createdAt: Date; updatedAt: Date },
): Grant {
  return {
    resourceId: grant.resourceId,
    userId: grant.userId,
    mode: grant.mode,
    createdAt: grant.createdAt.toISOString(),
    updatedAt: grant.updatedAt.toISOString(),
  };
}

@Injectable()
export class PermissionService {
  constructor(
    @Inject(PermissionsRuntimeKey) private readonly runtime: PermissionsRuntime,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}
  assert(
    context: { role: WorkspaceRole; workspaceId: string },
    action: PermissionAction,
    workspaceId: string,
  ) {
    if (context.workspaceId !== workspaceId)
      throw new ApiException(404, 'NOT_FOUND', 'Workspace not found');

    const allowed: Partial<Record<PermissionAction, readonly WorkspaceRole[]>> = {
      'workspace.read': ['admin', 'member'],
      'member.list': ['admin', 'member'],
      'member.manage': ['admin'],
      'container.read': ['admin', 'member'],
      'task.read': ['admin', 'member'],
      'activity.read': ['admin', 'member'],
      'task.write': ['admin', 'member'],
      'container.write': ['admin'],
      'grant.manage': ['admin'],
      'configuration.read': ['admin'],
      'configuration.write': ['admin'],
    };
    if (!allowed[action]?.includes(context.role))
      throw new ApiException(403, 'FORBIDDEN', 'Access denied');
  }
  private context(identity: IdentitySession) {
    if (!identity.activeWorkspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    return { actorUserId: identity.user.id, workspaceId: identity.activeWorkspace.id };
  }
  private storage() {
    if (!this.runtime.database)
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Permissions service unavailable');

    return this.runtime.database;
  }
  private cursor() {
    if (!this.runtime.cursor)
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Pagination unavailable');

    return this.runtime.cursor;
  }
  async assertNode(
    store: ReadRepositories,
    nodeId: string,
    action: PermissionAction,
  ): Promise<void> {
    const node = await store.nodes.find(nodeId);
    if (!node) throw new ApiException(404, 'NOT_FOUND', 'Container not found');

    this.assert(store.context, action, store.context.workspaceId);
    const snapshot = await store.access.snapshot();
    const visible = resolveVisibleTree(
      snapshot.nodes,
      snapshot.grants,
      store.context.workspaceId,
      store.context.role,
    );
    if (!visible.some((entry) => entry.node.id === nodeId))
      throw new ApiException(403, 'FORBIDDEN', 'Access denied');
  }
  async assertTask(store: ReadRepositories, taskId: string, action: PermissionAction) {
    const task = await store.tasks.find(taskId);
    await this.assertNode(store, task.primaryListId, action);

    return task;
  }
  async authorizeTask(identity: IdentitySession, taskId: string, action: PermissionAction) {
    await this.storage().read(this.context(identity), (store) =>
      this.assertTask(store, taskId, action),
    );
  }
  async assertScope(store: ReadRepositories, owner: StatusScope, action: PermissionAction) {
    await store.scopes.path(owner);
    if (owner.ownerType === 'workspace') this.assert(store.context, action, owner.ownerId);
    else await this.assertNode(store, owner.ownerId, action);
  }
  async authorizeScope(identity: IdentitySession, owner: StatusScope, action: PermissionAction) {
    await this.storage().read(this.context(identity), (store) =>
      this.assertScope(store, owner, action),
    );
  }
  async authorizeList(identity: IdentitySession, listId: string) {
    await this.storage().read(this.context(identity), async (store) => {
      await this.assertNode(store, listId, 'container.read');
      const node = await store.nodes.find(listId);
      if (node?.type !== 'list')
        throw new ApiException(400, 'VALIDATION_FAILED', 'Expected a list');
    });
  }
  async authorizeNode(identity: IdentitySession, nodeId: string, action: PermissionAction) {
    await this.storage().read(this.context(identity), (store) =>
      this.assertNode(store, nodeId, action),
    );
  }
  async listTree(
    identity: IdentitySession,
    query: { cursor?: string; limit: number },
  ): Promise<TreePage> {
    const context = this.context(identity);
    const codec = this.cursor();
    const binding = {
      caller: context.actorUserId,
      workspaceId: context.workspaceId,
      resource: 'tree',
      limit: query.limit,
    };
    const previous = codec.decodeTree(query.cursor, binding);

    return this.logger.observe('permissions.tree.list', () =>
      this.storage().read(context, async (store) => {
        this.assert(store.context, 'workspace.read', context.workspaceId);
        const { nodes, grants, workspace } = await store.access.snapshot();
        if (
          previous &&
          (previous.configVersion !== workspace.configVersion ||
            previous.dataVersion !== workspace.dataVersion)
        )
          throw new ApiException(409, 'CURSOR_STALE', 'Tree changed; restart pagination');

        const visible = resolveVisibleTree(nodes, grants, context.workspaceId, store.context.role);
        const offset = previous
          ? visible.findIndex((entry) => compareTreePositions(entry.path, previous.after) === 0) + 1
          : 0;
        if (previous && offset === 0)
          throw new ApiException(400, 'INVALID_CURSOR', 'Invalid tree position');

        const entries = visible.slice(offset, offset + query.limit);
        const last = entries.at(-1);
        const nextCursor =
          last && offset + query.limit < visible.length
            ? codec.encodeTree(binding, last.path, workspace, previous)
            : null;

        return {
          items: entries.map(({ node }) => ({
            id: node.id,
            workspaceId: node.workspaceId,
            name: node.name,
            type: node.type,
            parentId: node.parentId,
            position: node.position,
            visibility: node.visibility,
            version: node.version,
            archivedAt: null,
            createdAt: node.createdAt.toISOString(),
            updatedAt: node.updatedAt.toISOString(),
          })),
          pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
          root: { id: workspace.id, name: workspace.name, type: 'workspace' as const },
          configVersion: workspace.configVersion,
          dataVersion: workspace.dataVersion,
        };
      }),
    );
  }
  async listGrants(
    identity: IdentitySession,
    nodeId: string,
    query: { cursor?: string; limit: number },
  ): Promise<GrantPage> {
    const context = this.context(identity);
    const codec = this.cursor();
    const binding = {
      caller: context.actorUserId,
      workspaceId: context.workspaceId,
      resource: `grants:${nodeId}`,
      limit: query.limit,
    };
    const previous = codec.decode(query.cursor, binding);

    return this.logger.observe('permissions.grants.list', () =>
      this.storage().read(context, async (store) => {
        await this.assertNode(store, nodeId, 'grant.manage');
        const { configVersion } = await store.access.configuration();
        if (previous && previous.configVersion !== configVersion)
          throw new ApiException(409, 'CURSOR_STALE', 'Grants changed; restart pagination');

        const rows = await store.access.listGrants(nodeId, {
          limit: query.limit,
          ...(previous
            ? { after: { createdAt: new Date(previous.after.createdAt), id: previous.after.id } }
            : {}),
        });
        const items = rows.slice(0, query.limit);
        const last = items.at(-1);
        const nextCursor =
          last && rows.length > query.limit
            ? codec.encode(
                binding,
                { createdAt: last.createdAt, id: last.userId },
                previous,
                configVersion,
              )
            : null;

        return {
          items: items.map(presentGrant),
          configVersion,
          pageInfo: { nextCursor, hasNextPage: nextCursor !== null },
        };
      }),
    );
  }
  async upsertGrant(
    identity: IdentitySession,
    nodeId: string,
    input: UpsertGrant,
  ): Promise<GrantEnvelope> {
    return this.logger.observe('permissions.grants.upsert', () =>
      this.storage().write(this.context(identity), async (store) => {
        await this.assertNode(store, nodeId, 'grant.manage');
        const result = await store.access.upsertGrant(nodeId, input);

        return { data: presentGrant(result.data), configVersion: result.configVersion };
      }),
    );
  }
  async removeGrant(
    identity: IdentitySession,
    nodeId: string,
    userId: string,
    input: { expectedConfigVersion: number },
  ): Promise<void> {
    await this.logger.observe('permissions.grants.remove', () =>
      this.storage().write(this.context(identity), async (store) => {
        await this.assertNode(store, nodeId, 'grant.manage');
        await store.access.removeGrant(nodeId, userId, input);
      }),
    );
  }
}
