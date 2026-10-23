import { SilentLogger } from '@flowboard/logger';
import { Module } from '@nestjs/common';

import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

export const ApiLoggerKey = Symbol('ApiLogger');

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
