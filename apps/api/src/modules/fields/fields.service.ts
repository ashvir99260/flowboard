import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.js';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.js';
import { PermissionService } from '../permissions/permission.service.js';

import type { CreateScopeField, FieldScope, UpdateScopeField } from '@flowboard/contracts';
import type {
  Database,
  IdentitySession,
  ReadRepositories,
  WriteRepositories,
} from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export const FieldDatabaseKey = 'flowboard:field-database';

@Injectable()
export class FieldsService {
  constructor(
    @Inject(FieldDatabaseKey) private readonly database: Database | null,
    private readonly permissions: PermissionService,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}
  private read<T>(
    identity: IdentitySession,
    owner: FieldScope,
    config: boolean,
    action: (store: ReadRepositories) => Promise<T>,
  ) {
    if (!this.database) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Fields unavailable');

    if (!identity.activeWorkspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    const context = { actorUserId: identity.user.id, workspaceId: identity.activeWorkspace.id };

    return this.logger.observe('fields.read', () =>
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
    owner: FieldScope,
    action: (store: WriteRepositories) => Promise<T>,
  ) {
    if (!this.database) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Fields unavailable');

    if (!identity.activeWorkspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    const context = { actorUserId: identity.user.id, workspaceId: identity.activeWorkspace.id };

    return this.logger.observe('fields.write', () =>
      this.database!.write(context, async (store) => {
        await this.permissions.assertScope(store, owner, 'configuration.write');

        return action(store);
      }),
    );
  }
  create(identity: IdentitySession, owner: FieldScope, input: CreateScopeField) {
    return this.write(identity, owner, (store) => store.fields.create(owner, input));
  }
  update(identity: IdentitySession, owner: FieldScope, fieldId: string, input: UpdateScopeField) {
    return this.write(identity, owner, (store) => store.fields.update(owner, fieldId, input));
  }
  remove(
    identity: IdentitySession,
    owner: FieldScope,
    fieldId: string,
    input: { expectedConfigVersion: number },
  ) {
    return this.write(identity, owner, (store) => store.fields.remove(owner, fieldId, input));
  }
  list(identity: IdentitySession, owner: FieldScope) {
    return this.read(identity, owner, true, (store) => store.fields.local(owner));
  }
  resolve(identity: IdentitySession, listId: string) {
    return this.read(identity, { ownerType: 'list', ownerId: listId }, false, (store) =>
      store.fields.resolved(listId),
    );
  }
}
