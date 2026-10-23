import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { PermissionGuard } from './permission.guard.js';
import {
  ActiveWorkspaceKey,
  NodePermissionKey,
  PermissionActionKey,
  ScopePermissionKey,
} from './permission.service.js';

import type { PermissionAction } from '@flowboard/contracts';

export const WorkspacePermission = (action: PermissionAction) =>
  applyDecorators(SetMetadata(PermissionActionKey, action), UseGuards(PermissionGuard));

export const ActiveWorkspacePermission = (action: PermissionAction) =>
  applyDecorators(WorkspacePermission(action), SetMetadata(ActiveWorkspaceKey, true));

export const NodePermission = (action: PermissionAction, parameter = 'nodeId') =>
  applyDecorators(ActiveWorkspacePermission(action), SetMetadata(NodePermissionKey, parameter));

export const ScopePermission = (action: PermissionAction) =>
  applyDecorators(ActiveWorkspacePermission(action), SetMetadata(ScopePermissionKey, true));
