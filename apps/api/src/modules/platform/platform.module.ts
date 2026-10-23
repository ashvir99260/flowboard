import { Inject, Injectable, Module } from '@nestjs/common';

import { DependencyProbeKey } from './dependency-probe.js';
import { HealthController } from './health.controller.js';

import type { DependencyProbe } from './dependency-probe.js';
import type { DynamicModule, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
class ProbeLifecycle implements OnApplicationShutdown {
  constructor(@Inject(DependencyProbeKey) private readonly probe: DependencyProbe) {}
  async onApplicationShutdown() {
    await this.probe.close();
  }
}

@Module({ controllers: [HealthController], providers: [ProbeLifecycle] })
export class PlatformModule {
  static forProbe(probe: DependencyProbe): DynamicModule {
    return {
      module: PlatformModule,
      providers: [{ provide: DependencyProbeKey, useValue: probe }],
    };
  }
}
