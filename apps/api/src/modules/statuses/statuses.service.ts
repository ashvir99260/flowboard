import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.js';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.js';
import { PermissionService } from '../permissions/permission.service.js';

import type { CreateScopeStatus, StatusScope, UpdateScopeStatus } from '@flowboard/contracts';
import type {
  Database,
  IdentitySession,
  ReadRepositories,
  WriteRepositories,
} from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export const StatusDatabaseKey = 'flowboard:status-database';

@Injectable()
export class StatusesService {
  constructor(
    @Inject(StatusDatabaseKey) private readonly database: Database | null,
    private readonly permissions: PermissionService,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}
  private read<T>(
    identity: IdentitySession,
    owner: StatusScope,
    config: boolean,
    action: (store: ReadRepositories) => Promise<T>,
  ) {
    if (!this.database) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Statuses unavailable');

    if (!identity.activeWorkspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    const context = { actorUserId: identity.user.id, workspaceId: identity.activeWorkspace.id };

    return this.logger.observe('statuses.read', () =>
      this.database!.read(context, async (store) => {
        await this.permissions.assertScope(
          store,
          owner,
          config ? 'configuration.read' : 'container.read',
        );

        return action(store);
      }),
    );
  }
  private write<T>(
    identity: IdentitySession,
    owner: StatusScope,
    action: (store: WriteRepositories) => Promise<T>,
  ) {
    if (!this.database) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Statuses unavailable');

    if (!identity.activeWorkspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    const context = { actorUserId: identity.user.id, workspaceId: identity.activeWorkspace.id };

    return this.logger.observe('statuses.write', () =>
      this.database!.write(context, async (store) => {
        await this.permissions.assertScope(store, owner, 'configuration.write');

        return action(store);
      }),
    );
  }
  create(identity: IdentitySession, owner: StatusScope, input: CreateScopeStatus) {
    return this.write(identity, owner, (store) => store.statuses.create(owner, input));
  }
  update(
    identity: IdentitySession,
    owner: StatusScope,
    statusId: string,
    input: UpdateScopeStatus,
  ) {
    return this.write(identity, owner, (store) => store.statuses.update(owner, statusId, input));
  }
  remove(
    identity: IdentitySession,
    owner: StatusScope,
    statusId: string,
    input: { expectedConfigVersion: number },
  ) {
    return this.write(identity, owner, (store) => store.statuses.remove(owner, statusId, input));
  }
  list(identity: IdentitySession, owner: StatusScope) {
    return this.read(identity, owner, true, (store) => store.statuses.local(owner));
  }
  resolve(identity: IdentitySession, listId: string) {
    return this.read(identity, { ownerType: 'list', ownerId: listId }, false, (store) =>
      store.statuses.resolved(listId),
    );
  }
}
