import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bindLogContext,
  createLogger,
  readLogLevel,
  updateLogContext,
  withLogContext,
} from '../dist/index.js';

const requestA = '10000000-0000-4000-8000-000000000001';
const requestB = '10000000-0000-4000-8000-000000000002';
const workspace = '10000000-0000-4000-8000-000000000003';
const capture = (level = 'trace') => {
  const records = [];

  return {
    records,
    logger: createLogger({
      service: 'api',
      level,
      write: (line) => records.push(JSON.parse(line)),
    }),
  };
};

test('log levels filter consistently and invalid configuration fails safely', () => {
  const { logger, records } = capture('warn');
  for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    logger[level]('test.event');
  assert.deepEqual(
    records.map(({ level }) => level),
    ['warn', 'error', 'fatal'],
  );
  const silent = capture('silent');
  silent.logger.fatal('test.fatal');
  assert.equal(silent.records.length, 0);
  assert.equal(readLogLevel(undefined), 'info');
  assert.equal(readLogLevel('debug'), 'debug');
  assert.throws(() => readLogLevel('password-secret'), /LOG_LEVEL must be/);
});

test('serialization accepts only bounded semantic metadata and excludes arbitrary secrets', () => {
  const { logger, records } = capture();
  const secret = 'never-log-this';
  logger.error('test.failure', {
    component: 'auth',
    operation: 'login',
    code: 'UNAUTHENTICATED',
    statusCode: 401,
    durationMs: 1.25,
    password: secret,
    token: secret,
    headers: { authorization: secret },
    error: new Error(secret),
    body: secret,
    url: `https://user:${secret}@host.test?token=${secret}`,
  });
  assert.equal(records[0].component, 'auth');
  assert.equal(records[0].statusCode, 401);
  assert.doesNotMatch(
    JSON.stringify(records),
    /never-log-this|authorization|headers|password|https:/,
  );
  logger.info('test.invalid', { route: `/bad?token=${secret}`, durationMs: Infinity });
  assert.equal(records[1].route, undefined);
  assert.equal(records[1].durationMs, undefined);
});

test('async request context stays isolated and only verified UUID metadata is attached', async () => {
  const { logger, records } = capture();
  await Promise.all(
    [requestA, requestB].map((requestId) =>
      withLogContext({ requestId }, async () => {
        await new Promise((resolve) => setTimeout(resolve, requestId === requestA ? 5 : 1));
        updateLogContext({ workspaceId: workspace, userId: 'bad-secret' });
        logger.info('test.context');
      }),
    ),
  );
  assert.deepEqual(records.map(({ requestId }) => requestId).sort(), [requestA, requestB]);
  assert.ok(
    records.every((record) => record.workspaceId === workspace && record.userId === undefined),
  );
  logger.info('test.outside');
  assert.equal(records.at(-1).requestId, undefined);
});

test('observed work records completion or failure and rethrows the same error', async () => {
  const { logger, records } = capture();
  assert.equal(await logger.observe('database.read', async () => 42), 42);
  const failure = new Error('sensitive database URL');
  await assert.rejects(
    logger.observe('database.write', async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.deepEqual(
    records.map(({ event }) => event),
    ['operation.started', 'operation.completed', 'operation.started', 'operation.failed'],
  );
  assert.doesNotMatch(JSON.stringify(records), /sensitive database URL/);
});

test('a failed output sink never changes a business result or exception', async () => {
  const logger = createLogger({
    service: 'worker',
    level: 'trace',
    write: () => {
      throw new Error('sink unavailable');
    },
  });
  assert.doesNotThrow(() => logger.error('worker.failure'));
  assert.equal(await logger.observe('worker.process', async () => 'done'), 'done');
  const failure = new Error('domain failure');
  await assert.rejects(
    logger.observe('worker.process', async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
});

test('bound completion retains verified context while nested scopes restore their parent', () => {
  const { logger, records } = capture();
  let complete;
  withLogContext({ requestId: requestA }, () => {
    complete = bindLogContext(() => logger.info('test.bound'));
    withLogContext({ requestId: requestB }, () => logger.info('test.nested'));
    updateLogContext({ workspaceId: workspace });
    logger.info('test.parent');
  });
  complete();
  logger.info('test.outside');
  assert.deepEqual(
    records.map(({ requestId }) => requestId),
    [requestB, requestA, requestA, undefined],
  );
  assert.equal(records[2].workspaceId, workspace);
});

test('logger construction rejects invalid levels without exposing their value', () => {
  assert.throws(
    () => createLogger({ level: 'secret-invalid-level', service: 'api' }),
    (error) =>
      error instanceof Error &&
      error.message.startsWith('LOG_LEVEL must be') &&
      !error.message.includes('secret-invalid-level'),
  );
});

test('structured output retains the public envelope without extra process metadata', () => {
  const { logger, records } = capture();
  logger.info('test.envelope');
  assert.deepEqual(Object.keys(records[0]).sort(), ['event', 'level', 'service', 'time']);
  assert.equal(records[0].level, 'info');
  assert.equal(records[0].service, 'api');
  assert.equal(records[0].event, 'test.envelope');
  assert.ok(Number.isFinite(Date.parse(records[0].time)));
});
