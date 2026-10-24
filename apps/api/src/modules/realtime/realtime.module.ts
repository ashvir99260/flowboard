import { Module } from '@nestjs/common';

import { LoggingModule } from '../../shared/logging/logging.module.js';

import { RealtimeGateway } from './realtime.gateway.js';
import { RealtimeConfigKey, RealtimeService } from './realtime.service.js';

import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class RealtimeModule {
  static forRuntime(
    auth: DynamicModule,
    permissions: DynamicModule,
    logger: Logger,
    config?: { redisUrl: string },
  ): DynamicModule {
    return config
      ? {
          module: RealtimeModule,
          imports: [auth, permissions, LoggingModule.forLogger(logger)],
          providers: [
            RealtimeGateway,
            RealtimeService,
            { provide: RealtimeConfigKey, useValue: config },
          ],
        }
      : { module: RealtimeModule };
  }
}
