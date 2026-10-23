import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';

import { PermissionGuard } from './permission.guard.js';
import { PermissionActionKey } from './permission.service.js';

import type { PermissionAction } from '@flowboard/contracts';

export const WorkspacePermission = (action: PermissionAction) =>
  applyDecorators(SetMetadata(PermissionActionKey, action), UseGuards(PermissionGuard));
