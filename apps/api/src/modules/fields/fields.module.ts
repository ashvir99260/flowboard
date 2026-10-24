import { Module } from '@nestjs/common';

import { LoggingModule } from '../../shared/logging/logging.module.ts';

import { ListFieldsController, ScopeFieldsController } from './fields.controller.ts';
import { FieldDatabaseKey, FieldsService } from './fields.service.ts';

import type { Database } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({
  controllers: [ListFieldsController, ScopeFieldsController],
  providers: [FieldsService],
})
export class FieldsModule {
  static forDatabase(
    database: Database | undefined,
    logger: Logger,
    permissions: DynamicModule,
  ): DynamicModule {
    return {
      module: FieldsModule,
      imports: [LoggingModule.forLogger(logger), permissions],
      providers: [{ provide: FieldDatabaseKey, useValue: database ?? null }],
    };
  }
}
