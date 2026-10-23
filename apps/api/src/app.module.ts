import { Inject, Injectable, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { AuthController } from './auth/auth.controller.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthService } from './auth/auth.service.js';
import { AuthRuntimeKey } from './auth/runtime.js';
import { DependencyProbeKey } from './platform/dependency-probe.js';
import { HealthController } from './platform/health.controller.js';
import { HttpExceptionFilter } from './platform/http-exception.filter.js';

import type { AuthRuntime } from './auth/runtime.js';
import type { DependencyProbe } from './platform/dependency-probe.js';
import type { DynamicModule, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
class ProbeLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(DependencyProbeKey) private readonly probe: DependencyProbe,
    @Inject(AuthRuntimeKey) private readonly auth: AuthRuntime | undefined,
  ) {}
  async onApplicationShutdown() {
    await this.probe.close();
    await this.auth?.close();
  }
}

@Module({
  controllers: [HealthController, AuthController],
  providers: [
    ProbeLifecycle,
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {
  static forProbe(probe: DependencyProbe, auth?: AuthRuntime): DynamicModule {
    return {
      module: AppModule,
      providers: [
        { provide: DependencyProbeKey, useValue: probe },
        { provide: AuthRuntimeKey, useValue: auth },
      ],
    };
  }
}
