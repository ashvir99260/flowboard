import { Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.js';

import type { PermissionAction, WorkspaceRole } from '@flowboard/contracts';

export const PermissionActionKey = 'flowboard:permission-action';

@Injectable()
export class PermissionService {
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
    };
    if (!allowed[action]?.includes(context.role))
      throw new ApiException(403, 'FORBIDDEN', 'Access denied');
  }
}
