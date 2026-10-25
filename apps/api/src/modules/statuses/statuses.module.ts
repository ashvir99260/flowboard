import { Module } from '@nestjs/common';

import { LoggingModule } from '../../shared/logging/logging.module.ts';

import { ListStatusesController, ScopeStatusesController } from './statuses.controller.ts';
import { StatusDatabaseKey, StatusesService } from './statuses.service.ts';

import type { Database } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({
  controllers: [ListStatusesController, ScopeStatusesController],
  providers: [StatusesService],
})
export class StatusesModule {
  static forDatabase(
    database: Database | undefined,
    logger: Logger,
    permissions: DynamicModule,
  ): DynamicModule {
    return {
      module: StatusesModule,
      imports: [LoggingModule.forLogger(logger), permissions],
      providers: [{ provide: StatusDatabaseKey, useValue: database ?? null }],
    };
  }
}
