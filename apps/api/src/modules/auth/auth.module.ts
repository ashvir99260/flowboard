import { SilentLogger } from '@flowboard/logger';
import { Inject, Injectable, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { LoggingModule } from '../../shared/logging/logging.module.ts';

import { AuthController } from './auth.controller.ts';
import { AuthGuard } from './auth.guard.ts';
import { AuthService } from './auth.service.ts';
import { AuthRuntimeKey } from './runtime.ts';

import type { AuthRuntime } from './runtime.ts';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
class AuthLifecycle implements OnApplicationShutdown {
  constructor(@Inject(AuthRuntimeKey) private readonly runtime: AuthRuntime | undefined) {}
  async onApplicationShutdown() {
    await this.runtime?.close();
  }
}

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthLifecycle, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService],
})
export class AuthModule {
  static forRuntime(runtime?: AuthRuntime, logger: Logger = SilentLogger): DynamicModule {
    return {
      module: AuthModule,
      imports: [LoggingModule.forLogger(logger)],
      providers: [{ provide: AuthRuntimeKey, useValue: runtime }],
    };
  }
}
