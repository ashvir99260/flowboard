import { SilentLogger } from '@flowboard/logger';
import { Module } from '@nestjs/common';

import { LoggingModule } from '../../shared/logging/logging.module.js';

import { HierarchyDatabaseKey, HierarchyService } from './hierarchy.service.js';
import { NodesController } from './nodes.controller.js';
import { TreeController } from './tree.controller.js';

import type { Database } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({
  controllers: [NodesController, TreeController],
  providers: [HierarchyService],
})
export class HierarchyModule {
  static forDatabase(
    database?: Database,
    logger: Logger = SilentLogger,
    permissions?: DynamicModule,
  ): DynamicModule {
    return {
      module: HierarchyModule,
      imports: [LoggingModule.forLogger(logger), ...(permissions ? [permissions] : [])],
      providers: [{ provide: HierarchyDatabaseKey, useValue: database ?? null }],
    };
  }
}
