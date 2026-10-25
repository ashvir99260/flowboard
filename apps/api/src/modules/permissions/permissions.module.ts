import { SilentLogger } from '@flowboard/logger';
import { Module } from '@nestjs/common';

import { CursorCodec } from '../../core/common/cursor.ts';
import { LoggingModule } from '../../shared/logging/logging.module.ts';

import { GrantsController } from './grants.controller.ts';
import { PermissionGuard } from './permission.guard.ts';
import { PermissionService } from './permission.service.ts';
import { PermissionsRuntimeKey } from './permissions.runtime.ts';

import type { Database, IdentityRepository } from '@flowboard/database';
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
    identities?: IdentityRepository,
  ): DynamicModule {
    return {
      module: PermissionsModule,
      imports: [LoggingModule.forLogger(logger)],
      providers: [
        {
          provide: PermissionsRuntimeKey,
          useValue: { database, identities, cursor: secret ? new CursorCodec(secret) : undefined },
        },
      ],
    };
  }
}
