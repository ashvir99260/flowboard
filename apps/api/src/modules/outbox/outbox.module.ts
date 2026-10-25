import { Module } from '@nestjs/common';

import type { OutboxRuntime } from './outbox.runtime.ts';
import type { DynamicModule } from '@nestjs/common';

const OutboxRuntimeKey = Symbol('OutboxRuntime');

@Module({})
export class OutboxModule {
  static forRuntime(runtime?: OutboxRuntime): DynamicModule {
    return {
      module: OutboxModule,
      providers: runtime
        ? [
            {
              provide: OutboxRuntimeKey,
              useValue: {
                onApplicationBootstrap: () => runtime.start(),
                onApplicationShutdown: () => runtime.close(),
              },
            },
          ]
        : [],
    };
  }
}
