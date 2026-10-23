import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { HttpExceptionFilter } from '../common/filters/http-exception.filter.js';

import { LoggingModule } from './logging/logging.module.js';

import type { Logger } from '@flowboard/logger';
import type { DynamicModule } from '@nestjs/common';

@Module({
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_PIPE, useClass: ZodValidationPipe },
  ],
})
export class SharedModule {
  static forLogger(logger: Logger): DynamicModule {
    return { module: SharedModule, imports: [LoggingModule.forLogger(logger)] };
  }
}
