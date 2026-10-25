import { ListSubscriptionSchema, StatusScopeSchema, UuidSchema } from '@flowboard/contracts';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ApiException } from '../../core/common/errors/api-exception.ts';

import {
  ActiveWorkspaceKey,
  NodePermissionKey,
  PermissionActionKey,
  PermissionService,
  ScopePermissionKey,
  TaskPermissionKey,
} from './permission.service.ts';

import type { PermissionAction } from '@flowboard/contracts';
import type { IdentitySession } from '@flowboard/database';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (context.getType?.() === 'ws') {
      const socket = context
        .switchToWs()
        .getClient<{ connected: boolean; identity?: IdentitySession }>();
      const { identity } = socket;
      if (!socket.connected || !identity)
        throw new ApiException(401, 'UNAUTHENTICATED', 'Authentication required');

      const input = ListSubscriptionSchema.safeParse(context.switchToWs().getData<unknown>());
      if (!input.success)
        throw new ApiException(400, 'VALIDATION_FAILED', 'Invalid list subscription');

      await this.permissions.authorizeList(identity, input.data.listId);
      if (!socket.connected) throw new ApiException(401, 'UNAUTHENTICATED', 'Socket disconnected');

      return true;
    }

    const request = context.switchToHttp().getRequest<{
      identity?: IdentitySession;
      params: Record<string, string | undefined>;
    }>();
    const action = this.reflector.getAllAndOverride<PermissionAction>(PermissionActionKey, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!request.identity)
      throw new ApiException(401, 'UNAUTHENTICATED', 'Authentication required');

    const workspace = request.identity.activeWorkspace;
    if (!workspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    const activeScope = this.reflector.getAllAndOverride<boolean>(ActiveWorkspaceKey, [
      context.getHandler(),
      context.getClass(),
    ]);
    const target = UuidSchema.safeParse(activeScope ? workspace.id : request.params.workspaceId);
    if (!target.success)
      throw new ApiException(400, 'VALIDATION_FAILED', 'Invalid workspace ID', [
        { code: 'invalid_format', message: 'Expected workspace UUID', path: ['workspaceId'] },
      ]);

    if (!action) throw new ApiException(403, 'FORBIDDEN', 'Permission policy required');

    if (
      this.reflector.getAllAndOverride<boolean>(ScopePermissionKey, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      const owner = StatusScopeSchema.safeParse({
        ownerId: request.params.ownerId,
        ownerType: request.params.ownerType,
      });
      if (!owner.success) throw new ApiException(400, 'VALIDATION_FAILED', 'Invalid scope');

      await this.permissions.authorizeScope(request.identity, owner.data, action);

      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(TaskPermissionKey, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      const task = UuidSchema.safeParse(request.params.taskId);
      if (!task.success) throw new ApiException(400, 'VALIDATION_FAILED', 'Invalid task ID');

      await this.permissions.authorizeTask(request.identity, task.data.toLowerCase(), action);

      return true;
    }

    const parameter = this.reflector.getAllAndOverride<string>(NodePermissionKey, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (parameter) {
      const node = UuidSchema.safeParse(request.params[parameter]);
      if (!node.success)
        throw new ApiException(400, 'VALIDATION_FAILED', 'Invalid container ID', [
          { path: [parameter], code: 'invalid_format', message: 'Expected container UUID' },
        ]);

      await this.permissions.authorizeNode(request.identity, node.data.toLowerCase(), action);

      return true;
    }

    this.permissions.assert(
      { workspaceId: workspace.id, role: workspace.role },
      action,
      target.data.toLowerCase(),
    );

    return true;
  }
}
