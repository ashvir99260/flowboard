import { Module } from '@nestjs/common';

import { PermissionGuard } from './permission.guard.js';
import { PermissionService } from './permission.service.js';

@Module({
  providers: [PermissionGuard, PermissionService],
  exports: [PermissionGuard, PermissionService],
})
export class PermissionsModule {}
