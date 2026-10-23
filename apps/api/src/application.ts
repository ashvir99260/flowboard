import 'reflect-metadata';

import { randomUUID } from 'node:crypto';

import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

import { AppModule } from './app.module.js';

import type { DependencyProbe } from './platform/dependency-probe.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'node:http';

export async function createApplication(
  probe: DependencyProbe,
  options: { exposeDocs?: boolean } = {},
) {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forProbe(probe), {
    bodyParser: false,
    logger: false,
  });
  try {
    app.use((_request: IncomingMessage, response: ServerResponse, next: () => void) => {
      response.setHeader('X-Request-Id', randomUUID());
      next();
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
          .addBearerAuth(undefined, 'access-token')
          .addCookieAuth('flowboard_refresh', undefined, 'refresh-cookie')
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
