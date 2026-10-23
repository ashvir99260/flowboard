import { ContainerParentType } from '@flowboard/contracts';
import { DatabaseError } from '@flowboard/database';
import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.js';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.js';
import { PermissionService } from '../permissions/permission.service.js';

import type {
  CreateNode,
  NodeEnvelope,
  NodeVersion,
  PermissionAction,
  UpdateNode,
} from '@flowboard/contracts';
import type {
  Database,
  IdentitySession,
  NodeSnapshot,
  ReadRepositories,
  WriteRepositories,
} from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export const HierarchyDatabaseKey = 'flowboard:hierarchy-database';

function present({ node, configVersion, dataVersion }: NodeSnapshot): NodeEnvelope {
  return {
    data: {
      id: node.id,
      workspaceId: node.workspaceId,
      name: node.name,
      type: node.type,
      parentId: node.parentId,
      position: node.position,
      visibility: node.visibility,
      version: node.version,
      archivedAt: node.archivedAt?.toISOString() ?? null,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    },
    configVersion,
    dataVersion,
  };
}

@Injectable()
export class HierarchyService {
  constructor(
    @Inject(HierarchyDatabaseKey) private readonly database: Database | undefined,
    private readonly permissions: PermissionService,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}
  private scope(identity: IdentitySession, action: PermissionAction) {
    const workspace = identity.activeWorkspace;
    if (!workspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    this.permissions.assert(
      { role: workspace.role, workspaceId: workspace.id },
      action,
      workspace.id,
    );

    return { actorUserId: identity.user.id, workspaceId: workspace.id };
  }
  private storage() {
    if (!this.database)
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Hierarchy service unavailable');

    return this.database;
  }
  private write<T>(identity: IdentitySession, operation: (store: WriteRepositories) => Promise<T>) {
    const context = this.scope(identity, 'container.write');

    return this.logger.observe('hierarchy.write', async () => {
      try {
        return await this.storage().write(context, (store) => {
          this.permissions.assert(store.context, 'container.write', context.workspaceId);

          return operation(store);
        });
      } catch (error) {
        if (error instanceof DatabaseError && error.code === 'INVALID_PARENT')
          throw new ApiException(400, error.code, error.message, [
            { code: 'invalid_parent', message: error.message, path: ['parentId'] },
          ]);

        throw error;
      }
    });
  }
  async create(identity: IdentitySession, input: CreateNode) {
    return present(
      await this.write(identity, async (store) => {
        const parent = input.parentId === null ? null : await store.nodes.find(input.parentId);
        if (input.parentId !== null && !parent)
          throw new ApiException(404, 'NOT_FOUND', 'Container not found');

        if ((parent?.type ?? null) !== ContainerParentType[input.type])
          throw new ApiException(
            400,
            'INVALID_PARENT',
            'Container parent does not match its type',
            [
              {
                code: 'invalid_parent',
                message: 'Parent type does not match the requested container',
                path: ['parentId'],
              },
            ],
          );

        return store.hierarchy.create(input);
      }),
    );
  }
  async archive(identity: IdentitySession, nodeId: string, input: NodeVersion) {
    return this.write(identity, (store) => store.hierarchy.archive(nodeId, input));
  }
  async update(identity: IdentitySession, nodeId: string, input: UpdateNode) {
    return present(await this.write(identity, (store) => store.hierarchy.update(nodeId, input)));
  }
  async find(identity: IdentitySession, nodeId: string) {
    const context = this.scope(identity, 'container.read');

    return this.logger.observe('hierarchy.read', () =>
      this.storage().read(context, async (store: ReadRepositories) => {
        this.permissions.assert(store.context, 'container.read', context.workspaceId);
        const snapshot = await store.hierarchy.find(nodeId);
        if (!snapshot) throw new ApiException(404, 'NOT_FOUND', 'Container not found');

        return present(snapshot);
      }),
    );
  }
}
