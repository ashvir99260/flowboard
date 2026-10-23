import { EventEmitter } from 'node:events';

import { createLogger, updateLogContext } from '@flowboard/logger';
import { expect, test } from '@jest/globals';

import { NestLogger } from '../../../dist/common/logging/nest-logger.js';
import { requestLogging } from '../../../dist/common/logging/request-logging.js';

test('aborted requests emit one correlated outcome even outside their async context', () => {
  const records = [];
  const logger = createLogger({
    service: 'api',
    level: 'debug',
    write: (line) => records.push(JSON.parse(line)),
  });
  const response = Object.assign(new EventEmitter(), {
    statusCode: 200,
    writableFinished: false,
    setHeader() {},
  });
  requestLogging(logger)({ method: 'GET', route: { path: '/v1/tasks/:id' } }, response, () => {
    updateLogContext({ userId: '10000000-0000-4000-8000-000000000001' });
  });
  response.emit('close');
  response.emit('finish');
  const completed = records.filter(({ event }) => event === 'http.completed');
  expect(completed).toHaveLength(1);
  expect(completed[0]).toMatchObject({
    outcome: 'aborted',
    level: 'error',
    route: '/v1/tasks/:id',
    userId: '10000000-0000-4000-8000-000000000001',
    requestId: records[0].requestId,
  });
});

test('Nest adapter preserves severity without serializing messages, context or exception stacks', () => {
  const records = [];
  const adapter = new NestLogger(
    createLogger({
      service: 'api',
      level: 'trace',
      write: (line) => records.push(JSON.parse(line)),
    }),
  );
  for (const method of ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'])
    adapter[method](new Error('secret-message'), 'secret-stack', 'secret-context');
  expect(records.map(({ level }) => level)).toEqual([
    'debug',
    'error',
    'warn',
    'debug',
    'trace',
    'fatal',
  ]);
  expect(JSON.stringify(records)).not.toContain('secret');
});
