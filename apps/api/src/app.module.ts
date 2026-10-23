import { Module } from '@nestjs/common';

import { AuthModule } from './auth/auth.module.js';
import { CommonModule } from './common/common.module.js';
import { PlatformModule } from './platform/platform.module.js';

import type { AuthRuntime } from './auth/runtime.js';
import type { DependencyProbe } from './platform/dependency-probe.js';
import type { DynamicModule } from '@nestjs/common';

@Module({})
export class AppModule {
  static forProbe(probe: DependencyProbe, auth?: AuthRuntime): DynamicModule {
    return {
      module: AppModule,
      imports: [CommonModule, PlatformModule.forProbe(probe), AuthModule.forRuntime(auth)],
    };
  }
}
