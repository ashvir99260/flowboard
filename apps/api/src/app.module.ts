import { SilentLogger } from '@flowboard/logger';
import { Module } from '@nestjs/common';

import { AuthModule } from './modules/auth/auth.module.js';
import { PlatformModule } from './modules/platform/platform.module.js';
import { SharedModule } from './shared/shared.module.js';

import type { AuthRuntime } from './modules/auth/runtime.js';
import type { DependencyProbe } from './modules/platform/dependency-probe.js';
import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class AppModule {
  static forProbe(
    probe: DependencyProbe,
    auth?: AuthRuntime,
    logger: Logger = SilentLogger,
  ): DynamicModule {
    return {
      module: AppModule,
      imports: [
        SharedModule.forLogger(logger),
        PlatformModule.forProbe(probe),
        AuthModule.forRuntime(auth, logger),
      ],
    };
  }
}
