import { SilentLogger } from '@flowboard/logger';
import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module.js';
import { FieldsModule } from './modules/fields/fields.module.js';
import { HierarchyModule } from './modules/hierarchy/hierarchy.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { StatusesModule } from './modules/statuses/statuses.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { SharedModule } from './shared/shared.module.js';

import type { AuthRuntime } from './modules/auth/runtime.js';
import type { DependencyProbe } from './modules/platform/dependency-probe.js';
import type { Database } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class AppModule {
  static forProbe(
    probe: DependencyProbe,
    auth?: AuthRuntime,
    logger: Logger = SilentLogger,
    database?: Database,
  ): DynamicModule {
    const permissions = PermissionsModule.forRuntime(database, auth?.settings.secret, logger);

    return {
      module: AppModule,
      imports: [
        SharedModule.forLogger(logger),
        PlatformModule.forProbe(probe),
        AuthModule.forRuntime(auth, logger),
        WorkspacesModule.forRuntime(
          database,
          auth?.identities,
          auth?.settings.secret,
          logger,
          permissions,
        ),
        HierarchyModule.forDatabase(database, logger, permissions),
        StatusesModule.forDatabase(database, logger, permissions),
        FieldsModule.forDatabase(database, logger, permissions),
      ],
    };
  }
}
