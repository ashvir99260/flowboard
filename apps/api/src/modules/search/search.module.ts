import { Module } from '@nestjs/common';

import { CursorCodec } from '../../core/common/cursor.ts';
import { LoggingModule } from '../../shared/logging/logging.module.ts';

import { SearchController } from './search.controller.ts';
import { SearchRuntimeKey, SearchService } from './search.service.ts';

import type { Database } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({ controllers: [SearchController], providers: [SearchService] })
export class SearchModule {
  static forDatabase(
    database: Database | undefined,
    secret: Uint8Array | undefined,
    logger: Logger,
    permissions: DynamicModule,
  ): DynamicModule {
    return {
      module: SearchModule,
      imports: [LoggingModule.forLogger(logger), permissions],
      providers: [
        {
          provide: SearchRuntimeKey,
          useValue: { database, cursor: secret ? new CursorCodec(secret) : undefined },
        },
      ],
    };
  }
}
