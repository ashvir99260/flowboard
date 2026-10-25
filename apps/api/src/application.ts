import 'reflect-metadata';

import { SilentLogger } from '@flowboard/logger';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module.ts';
import { GracefulExpressAdapter } from './core/common/graceful-express-adapter.ts';
import { runtimeDocumentation } from './core/common/swagger/runtime-documentation.ts';
import { RealtimeService } from './modules/realtime/realtime.service.ts';
import { NestLogger } from './shared/logging/nest-logger.ts';
import { requestLogging } from './shared/logging/request-logging.ts';

import type { AuthRuntime } from './modules/auth/runtime.ts';
import type { OutboxRuntime } from './modules/outbox/outbox.runtime.ts';
import type { DependencyProbe } from './modules/platform/dependency-probe.ts';
import type { Database } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'node:http';

export async function createApplication(
  probe: DependencyProbe,
  options: {
    auth?: AuthRuntime;
    database?: Database;
    docsBasePath?: '/' | '/api';
    exposeDocs?: boolean;
    logger?: Logger;
    outbox?: OutboxRuntime;
    realtime?: { redisUrl: string };
  } = {},
) {
  const logger = options.logger ?? SilentLogger;
  let realtimeReady = () => false;
  const checkedProbe = options.realtime
    ? {
        close: () => probe.close(),
        async check() {
          await probe.check();
          if (!realtimeReady()) throw new Error('Realtime unavailable');
        },
      }
    : probe;
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forProbe(
      checkedProbe,
      options.auth,
      logger,
      options.database,
      options.outbox,
      options.realtime,
    ),
    new GracefulExpressAdapter(),
    {
      bodyParser: false,
      logger: options.logger ? new NestLogger(logger) : false,
      abortOnError: false,
    },
  );
  if (options.realtime) realtimeReady = () => app.get(RealtimeService).isReady();

  try {
    app.use(requestLogging(logger));
    app.use('/v1', (_request: IncomingMessage, response: ServerResponse, next: () => void) => {
      response.setHeader('Cache-Control', 'no-store');
      next();
    });
    if (options.auth)
      app.enableCors({
        origin: options.auth.settings.allowedOrigins,
        credentials: true,
        exposedHeaders: ['X-Request-Id'],
      });

    app.useBodyParser('json', { limit: '256kb' });
    app.setGlobalPrefix('v1', { exclude: ['health/live', 'health/ready'] });
    const document = cleanupOpenApiDoc(
      SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
          .setTitle('Flowboard API')
          .setDescription('Workspace-scoped project management API')
          .setVersion('1.0.0')
          .addTag('Health', 'Service liveness and readiness')
          .addTag('Authentication', 'Account and session lifecycle')
          .addTag('Workspaces', 'Workspace memberships, invitations and current identity')
          .addTag('Statuses', 'Scoped status configuration and list inheritance')
          .addTag('Fields', 'Scoped custom-field configuration and list inheritance')
          .addTag('Tasks', 'Authorized task reads and cursor pagination')
          .addTag('Search', 'Authorized task and list search in the active workspace')
          .addTag('Activity', 'Authorized asynchronous task status history')
          .addTag('Hierarchy', 'Workspace spaces, folders and lists')
          .addTag('Permissions', 'Administrator-managed container access grants')
          .addBearerAuth(
            {
              bearerFormat: 'JWT',
              description:
                'Short-lived access JWT returned by login/signup/refresh. Send Authorization: Bearer <accessToken>. Placeholder documentation tokens are not valid credentials.',
              scheme: 'bearer',
              type: 'http',
            },
            'access-token',
          )
          .addCookieAuth(
            'flowboard_refresh',
            {
              description:
                'Host-only httpOnly refresh cookie set by signup/login/refresh. Send it together with an allowed Origin. It rotates once per refresh and is never included in JSON. Browsers manage this cookie automatically.',
              in: 'cookie',
              type: 'apiKey',
            },
            'refresh-cookie',
          )
          .build(),
      ),
    );
    if (options.exposeDocs)
      SwaggerModule.setup(
        'docs',
        app,
        runtimeDocumentation(document, options.docsBasePath ?? '/'),
        { swaggerOptions: { persistAuthorization: false, withCredentials: true } },
      );

    return { app, document };
  } catch (error) {
    await app.close();
    throw error;
  }
}
