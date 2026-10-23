import { UuidSchema } from '@flowboard/contracts';
import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ApiException } from '../../core/common/errors/api-exception.js';

import {
  ActiveWorkspaceKey,
  PermissionActionKey,
  PermissionService,
} from './permission.service.js';

import type { PermissionAction } from '@flowboard/contracts';
import type { IdentitySession } from '@flowboard/database';
import type { CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
  ) {}
  canActivate(context: ExecutionContext) {
    const request = context
      .switchToHttp()
      .getRequest<{ identity?: IdentitySession; params: { workspaceId?: string } }>();
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

    this.permissions.assert(
      { workspaceId: workspace.id, role: workspace.role },
      action,
      target.data.toLowerCase(),
    );

    return true;
  }
}
