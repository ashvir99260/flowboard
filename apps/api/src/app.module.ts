import { Inject, Injectable, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { DependencyProbeKey } from './platform/dependency-probe.js';
import { HealthController } from './platform/health.controller.js';
import { HttpExceptionFilter } from './platform/http-exception.filter.js';

import type { DependencyProbe } from './platform/dependency-probe.js';
import type { DynamicModule, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
class ProbeLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DependencyProbeKey) private readonly probe: DependencyProbe) {}
  async onApplicationShutdown() {
    await this.probe.close();
  }
}

@Module({
  controllers: [HealthController],
  providers: [
    ProbeLifecycle,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class AppModule {
  static forProbe(probe: DependencyProbe): DynamicModule {
    return { module: AppModule, providers: [{ provide: DependencyProbeKey, useValue: probe }] };
  }
}
