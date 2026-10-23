import { SilentLogger } from '@flowboard/logger';
import { Inject, Injectable, Module } from '@nestjs/common';

import { CursorCodec } from '../../core/common/cursor.js';
import { LoggingModule } from '../../shared/logging/logging.module.js';

import { WorkspacesController } from './workspaces.controller.js';
import { WorkspacesRuntimeKey } from './workspaces.runtime.js';
import { WorkspacesService } from './workspaces.service.js';

import type { WorkspacesRuntime } from './workspaces.runtime.js';
import type { Database, IdentityRepository } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
class WorkspaceLifecycle implements OnApplicationShutdown {
  constructor(@Inject(WorkspacesRuntimeKey) private readonly runtime: WorkspacesRuntime) {}
  async onApplicationShutdown() {
    await this.runtime.database?.close();
  }
}

@Module({
  controllers: [WorkspacesController],
  providers: [WorkspacesService, WorkspaceLifecycle],
})
export class WorkspacesModule {
  static forRuntime(
    database?: Database,
    identities?: IdentityRepository,
    secret?: Uint8Array,
    logger: Logger = SilentLogger,
    permissions?: DynamicModule,
  ): DynamicModule {
    return {
      module: WorkspacesModule,
      imports: [LoggingModule.forLogger(logger), ...(permissions ? [permissions] : [])],
      providers: [
        {
          provide: WorkspacesRuntimeKey,
          useValue: {
            database,
            identities,
            cursor: secret ? new CursorCodec(secret) : undefined,
          } satisfies WorkspacesRuntime,
        },
      ],
    };
  }
}
