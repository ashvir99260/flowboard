import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.ts';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.ts';
import { PermissionService } from '../permissions/permission.service.ts';

import { WorkspacesRuntimeKey } from './workspaces.runtime.ts';

import type { WorkspacesRuntime } from './workspaces.runtime.ts';
import type {
  AddMember,
  MemberMutationEnvelope,
  MemberPage,
  UpdateMember,
  WorkspacePage,
} from '@flowboard/contracts';
import type {
  AcceptedInvitationEnvelope,
  CreateInvitation,
  InvitationEnvelope,
} from '@flowboard/contracts';
import type { IdentitySession, MemberProfile, WriteRepositories } from '@flowboard/database';
import type { AuthenticatedIdentity } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export function serializeAudit<T extends { createdAt: Date; updatedAt: Date }>(entity: T) {
  return {
    ...entity,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  };
}

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(WorkspacesRuntimeKey) private readonly runtime: WorkspacesRuntime,
    private readonly permissions: PermissionService,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}
  private resources() {
    const { cursor, database, identities } = this.runtime;
    if (!cursor || !database || !identities)
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Workspace service unavailable');

    return { cursor, database, identities };
  }
  private write<T>(
    identity: IdentitySession,
    workspaceId: string,
    operation: (store: WriteRepositories) => Promise<T>,
  ) {
    const active = identity.activeWorkspace;
    if (!active)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    this.permissions.assert(
      { role: active.role, workspaceId: active.id },
      'member.manage',
      workspaceId,
    );

    return this.logger.observe('workspace.membership.write', () =>
      this.resources().database.write(
        { actorUserId: identity.user.id, workspaceId },
        async (store) => {
          this.permissions.assert(store.context, 'member.manage', workspaceId);

          return operation(store);
        },
      ),
    );
  }
  private memberResult(result: {
    configVersion: number;
    member: MemberProfile;
  }): MemberMutationEnvelope {
    const { workspaceId: _workspace, ...member } = result.member;

    return { data: serializeAudit(member), configVersion: result.configVersion };
  }
  async addMember(identity: IdentitySession, workspaceId: string, input: AddMember) {
    return this.memberResult(
      await this.write(identity, workspaceId, (store) => store.memberships.add(input)),
    );
  }
  async updateMember(
    identity: IdentitySession,
    workspaceId: string,
    userId: string,
    input: UpdateMember,
  ) {
    return this.memberResult(
      await this.write(identity, workspaceId, (store) => store.memberships.update(userId, input)),
    );
  }
  async removeMember(
    identity: IdentitySession,
    workspaceId: string,
    userId: string,
    expectedConfigVersion: number,
  ) {
    return this.write(identity, workspaceId, (store) =>
      store.memberships.remove(userId, expectedConfigVersion),
    );
  }
  async createInvitation(
    identity: IdentitySession,
    workspaceId: string,
    input: CreateInvitation,
  ): Promise<InvitationEnvelope> {
    const token = randomBytes(32).toString('base64url');
    const digest = createHash('sha256').update(token).digest('hex');
    const result = await this.write(identity, workspaceId, (store) =>
      store.memberships.invite(input, digest),
    );

    return {
      data: {
        invitationId: result.invitation.id,
        expiresAt: result.invitation.expiresAt.toISOString(),
        token,
      },
      configVersion: result.configVersion,
    };
  }
  async acceptInvitation(
    identity: AuthenticatedIdentity,
    token: string,
  ): Promise<AcceptedInvitationEnvelope> {
    const digest = createHash('sha256').update(token).digest('hex');
    const workspace = await this.logger.observe('workspace.invitation.accept', () =>
      this.resources().identities.acceptInvitation(
        {
          userId: identity.user.id,
          familyId: identity.familyId,
          workspaceId: identity.selectedWorkspaceId,
        },
        digest,
      ),
    );

    return { data: serializeAudit(workspace) };
  }
  async listWorkspaces(
    identity: IdentitySession,
    query: { cursor?: string; limit: number },
  ): Promise<WorkspacePage> {
    const { cursor, identities } = this.resources();
    const binding = {
      caller: identity.user.id,
      workspaceId: identity.activeWorkspace?.id ?? null,
      resource: 'workspaces',
      limit: query.limit,
    };
    const previous = cursor.decode(query.cursor, binding);
    const rows = await this.logger.observe('workspace.list', () =>
      identities.listWorkspaces(identity.user.id, {
        limit: query.limit,
        ...(previous
          ? { after: { createdAt: new Date(previous.after.createdAt), id: previous.after.id } }
          : {}),
      }),
    );
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const nextCursor =
      rows.length > query.limit && last
        ? cursor.encode(
            binding,
            { createdAt: last.membershipCreatedAt, id: last.workspace.id },
            previous,
          )
        : null;

    return {
      items: items.map(({ workspace }) => serializeAudit(workspace)),
      pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
    };
  }
  async listMembers(
    identity: IdentitySession,
    workspaceId: string,
    query: { assignableToListId?: string; cursor?: string; limit: number },
  ): Promise<MemberPage> {
    const { cursor, database } = this.resources();
    const binding = {
      caller: identity.user.id,
      workspaceId,
      resource: `members:${workspaceId}${query.assignableToListId ? `:${query.assignableToListId}` : ''}`,
      limit: query.limit,
    };
    const previous = cursor.decode(query.cursor, binding);

    return this.logger.observe('workspace.members.list', () =>
      database.read({ actorUserId: identity.user.id, workspaceId }, async (view) => {
        this.permissions.assert(view.context, 'member.list', workspaceId);
        if (query.assignableToListId) {
          await view.scopes.path({ ownerType: 'list', ownerId: query.assignableToListId });
          await this.permissions.assertNode(view, query.assignableToListId, 'container.read');
        }

        const { configVersion } = await view.memberships.configuration();
        if (previous && previous.configVersion !== configVersion)
          throw new ApiException(409, 'CURSOR_STALE', 'Membership changed; restart pagination');

        const rows = await view.memberships.list({
          limit: query.limit,
          ...(query.assignableToListId ? { assignableToListId: query.assignableToListId } : {}),
          ...(previous
            ? { after: { createdAt: new Date(previous.after.createdAt), id: previous.after.id } }
            : {}),
        });
        const page = rows.slice(0, query.limit);
        const last = page.at(-1);
        const nextCursor =
          rows.length > query.limit && last
            ? cursor.encode(
                binding,
                { createdAt: last.createdAt, id: last.userId },
                previous,
                configVersion,
              )
            : null;

        return {
          configVersion,
          items: page.map(({ workspaceId: _workspace, email, ...member }) => ({
            ...serializeAudit(member),
            ...(view.context.role === 'admin' || member.userId === identity.user.id
              ? { email }
              : {}),
          })),
          pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
        };
      }),
    );
  }
}
