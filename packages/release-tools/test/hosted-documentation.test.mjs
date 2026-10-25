import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../../../vercel.json', import.meta.url), 'utf8'));
const serviceFor = (path) =>
  config.rewrites.find((route) => new RegExp(`^${route.source}$`).test(path))?.destination.service;

test('hosted Swagger and public probes route to API while REST stays behind web', () => {
  for (const path of [
    '/docs',
    '/docs/',
    '/docs/swagger-ui.css',
    '/docs/swagger-ui-init.js',
    '/docs-json',
    '/docs-yaml',
    '/health/live',
    '/health/ready',
  ]) {
    assert.equal(serviceFor(path), 'api', path);
  }
  for (const path of ['/api/v1/tasks', '/v1/tasks', '/docs-other', '/health/live/extra']) {
    assert.equal(serviceFor(path), 'web', path);
  }
});
