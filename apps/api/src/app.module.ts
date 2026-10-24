import { SilentLogger } from '@flowboard/logger';
import { Module } from '@nestjs/common';

import { ActivityModule } from './modules/activity/activity.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { FieldsModule } from './modules/fields/fields.module.js';
import { HierarchyModule } from './modules/hierarchy/hierarchy.module.js';
import { OutboxModule } from './modules/outbox/outbox.module.js';
import { PermissionsModule } from './modules/permissions/permissions.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { StatusesModule } from './modules/statuses/statuses.module.js';
import { TasksModule } from './modules/tasks/tasks.module.js';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.js';
import { SharedModule } from './shared/shared.module.js';

import type { AuthRuntime } from './modules/auth/runtime.js';
import type { OutboxRuntime } from './modules/outbox/outbox.runtime.js';
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
    outbox?: OutboxRuntime,
    realtime?: { redisUrl: string },
  ): DynamicModule {
    const authentication = AuthModule.forRuntime(auth, logger);
    const permissions = PermissionsModule.forRuntime(database, auth?.settings.secret, logger);

    return {
      module: AppModule,
      imports: [
        SharedModule.forLogger(logger),
        PlatformModule.forProbe(probe),
        OutboxModule.forRuntime(outbox),
        authentication,
        RealtimeModule.forRuntime(authentication, permissions, logger, realtime),
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
        TasksModule.forDatabase(database, auth?.settings.secret, logger, permissions),
        ActivityModule.forDatabase(database, auth?.settings.secret, logger, permissions),
      ],
    };
  }
}
