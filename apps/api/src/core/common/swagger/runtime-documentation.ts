import type { OpenAPIObject } from '@nestjs/swagger';

export function runtimeDocumentation(document: OpenAPIObject, basePath: '/' | '/api') {
  return {
    ...document,
    paths: Object.fromEntries(
      Object.entries(document.paths).map(([path, item]) => [
        path,
        path === '/health/live' || path === '/health/ready'
          ? { ...item, servers: [{ url: '/' }] }
          : item,
      ]),
    ),
    servers: [{ url: basePath }],
  };
}
