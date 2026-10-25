import { SilentLogger } from '@flowboard/logger';
import { Module } from '@nestjs/common';

import { ActivityModule } from './modules/activity/activity.module.ts';
import { AuthModule } from './modules/auth/auth.module.ts';
import { FieldsModule } from './modules/fields/fields.module.ts';
import { HierarchyModule } from './modules/hierarchy/hierarchy.module.ts';
import { OutboxModule } from './modules/outbox/outbox.module.ts';
import { PermissionsModule } from './modules/permissions/permissions.module.ts';
import { PlatformModule } from './modules/platform/platform.module.ts';
import { RealtimeModule } from './modules/realtime/realtime.module.ts';
import { StatusesModule } from './modules/statuses/statuses.module.ts';
import { TasksModule } from './modules/tasks/tasks.module.ts';
import { WorkspacesModule } from './modules/workspaces/workspaces.module.ts';
import { SharedModule } from './shared/shared.module.ts';

import type { AuthRuntime } from './modules/auth/runtime.ts';
import type { OutboxRuntime } from './modules/outbox/outbox.runtime.ts';
import type { DependencyProbe } from './modules/platform/dependency-probe.ts';
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
    const permissions = PermissionsModule.forRuntime(
      database,
      auth?.settings.secret,
      logger,
      auth?.identities,
    );

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
