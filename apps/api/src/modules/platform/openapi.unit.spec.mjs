import { expect, test } from '@jest/globals';

import { exportOpenApi } from '../../../dist/spec-bootstrap.js';

test('the spec-only bootstrap exposes real typed controller metadata without configuration', async () => {
  const document = await exportOpenApi();
  expect(Object.keys(document.paths).sort()).toEqual([
    '/health/live',
    '/health/ready',
    '/v1/auth/login',
    '/v1/auth/logout',
    '/v1/auth/refresh',
    '/v1/auth/signup',
    '/v1/auth/switch-workspace',
    '/v1/invitations/accept',
    '/v1/me',
    '/v1/nodes',
    '/v1/nodes/{nodeId}',
    '/v1/nodes/{nodeId}/grants',
    '/v1/nodes/{nodeId}/grants/{userId}',
    '/v1/nodes/{nodeId}/reorder',
    '/v1/tree',
    '/v1/workspaces',
    '/v1/workspaces/{workspaceId}/invitations',
    '/v1/workspaces/{workspaceId}/members',
    '/v1/workspaces/{workspaceId}/members/{userId}',
  ]);
  expect(document.paths['/health/live'].get.operationId).toBe('getLiveness');
  expect(document.paths['/health/ready'].get.operationId).toBe('getReadiness');
  expect(
    document.paths['/health/ready'].get.responses['503'].content['application/json'].schema,
  ).toBeDefined();
  expect(JSON.stringify(document)).not.toContain('passwordHash');
});
