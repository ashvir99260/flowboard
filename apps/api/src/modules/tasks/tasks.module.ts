import { Module } from '@nestjs/common';

import { CursorCodec } from '../../core/common/cursor.ts';
import { LoggingModule } from '../../shared/logging/logging.module.ts';

import { ListTasksController, TasksController } from './tasks.controller.ts';
import { TasksRuntimeKey, TasksService } from './tasks.service.ts';

import type { Database } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({ controllers: [ListTasksController, TasksController], providers: [TasksService] })
export class TasksModule {
  static forDatabase(
    database: Database | undefined,
    secret: Uint8Array | undefined,
    logger: Logger,
    permissions: DynamicModule,
  ): DynamicModule {
    return {
      module: TasksModule,
      imports: [LoggingModule.forLogger(logger), permissions],
      providers: [
        {
          provide: TasksRuntimeKey,
          useValue: { database, cursor: secret ? new CursorCodec(secret) : undefined },
        },
      ],
    };
  }
}
