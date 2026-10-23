import { SilentLogger } from '@flowboard/logger';
import { Module } from '@nestjs/common';

import { ApiLoggerKey } from '../../core/common/tokens/logger.token.js';

import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class LoggingModule {
  static forLogger(logger: Logger = SilentLogger): DynamicModule {
    return {
      module: LoggingModule,
      providers: [{ provide: ApiLoggerKey, useValue: logger }],
      exports: [ApiLoggerKey],
    };
  }
}
