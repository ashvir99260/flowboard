import { SilentLogger } from '@flowboard/logger';
import { Module } from '@nestjs/common';

import { CursorCodec } from '../../core/common/cursor.js';
import { LoggingModule } from '../../shared/logging/logging.module.js';

import { GrantsController } from './grants.controller.js';
import { PermissionGuard } from './permission.guard.js';
import { PermissionService } from './permission.service.js';
import { PermissionsRuntimeKey } from './permissions.runtime.js';

import type { Database } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({
  controllers: [GrantsController],
  providers: [PermissionGuard, PermissionService],
  exports: [PermissionGuard, PermissionService],
})
export class PermissionsModule {
  static forRuntime(
    database?: Database,
    secret?: Uint8Array,
    logger: Logger = SilentLogger,
  ): DynamicModule {
    return {
      module: PermissionsModule,
      imports: [LoggingModule.forLogger(logger)],
      providers: [
        {
          provide: PermissionsRuntimeKey,
          useValue: { database, cursor: secret ? new CursorCodec(secret) : undefined },
        },
      ],
    };
  }
}
