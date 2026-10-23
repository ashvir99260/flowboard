import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module.js';

import type { AuthRuntime } from './auth/runtime.js';
import type { DependencyProbe } from './platform/dependency-probe.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'node:http';

export async function createApplication(
  probe: DependencyProbe,
  options: { auth?: AuthRuntime; exposeDocs?: boolean } = {},
) {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forProbe(probe, options.auth),
    {
      bodyParser: false,
      logger: false,
    },
  );
  try {
    app.use((_request: IncomingMessage, response: ServerResponse, next: () => void) => {
      response.setHeader('X-Request-Id', randomUUID());
      next();
    });
    app.use('/v1/auth', (_request: IncomingMessage, response: ServerResponse, next: () => void) => {
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
    if (options.exposeDocs) SwaggerModule.setup('docs', app, document);
    return { app, document };
  } catch (error) {
    await app.close();
    throw error;
  }
}
