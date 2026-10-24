import { Module } from '@nestjs/common';

import { CursorCodec } from '../../core/common/cursor.ts';
import { LoggingModule } from '../../shared/logging/logging.module.ts';

import { ActivityController } from './activity.controller.ts';
import { ActivityRuntimeKey, ActivityService } from './activity.service.ts';

import type { Database } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({ controllers: [ActivityController], providers: [ActivityService] })
export class ActivityModule {
  static forDatabase(
    database: Database | undefined,
    secret: Uint8Array | undefined,
    logger: Logger,
    permissions: DynamicModule,
  ): DynamicModule {
    return {
      module: ActivityModule,
      imports: [LoggingModule.forLogger(logger), permissions],
      providers: [
        {
          provide: ActivityRuntimeKey,
          useValue: { database, cursor: secret ? new CursorCodec(secret) : undefined },
        },
      ],
    };
  }
}
