import { randomUUID } from 'node:crypto';

import { expect, test } from '@jest/globals';

import { createApplication } from '../../../dist/application.js';
import { createOutboxDispatcher, retryDelay } from '../../../dist/modules/outbox/outbox.service.js';

function fixture() {
  const listId = randomUUID();
  const row = {
    id: randomUUID(),
    workspaceId: randomUUID(),
    actorId: randomUUID(),
    aggregateId: randomUUID(),
    aggregateVersion: 2,
    aggregateType: 'task',
    eventType: 'task.updated',
    schemaVersion: 1,
    attempts: 1,
    leaseToken: randomUUID(),
  };
  row.payload = {
    eventId: row.id,
    workspaceId: row.workspaceId,
    actorId: row.actorId,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    taskId: row.aggregateId,
    taskVersion: 2,
    currentListId: listId,
    previousListId: listId,
    changes: { title: true },
  };
  const actions = [];
  let claims = [row];
  const repository = {
    claim: async () => {
      const batch = claims;
      claims = [];

      return batch;
    },
    markQueued: async (claim) => {
      actions.push(['queued', claim.id]);

      return true;
    },
    retry: async (claim, options) => {
      actions.push(['retry', claim.id, options]);

      return true;
    },
    quarantine: async (claim) => {
      actions.push(['quarantine', claim.id]);

      return true;
    },
    close: async () => {},
  };

  return {
    row,
    actions,
    repository,
    setClaims: (value) => {
      claims = value;
    },
  };
}

test('publishes only the verified stable job reference then acknowledges queued', async () => {
  const { row, repository, actions } = fixture();
  const jobs = [];
  const dispatcher = createOutboxDispatcher(repository, {
    publish: async (job) => {
      jobs.push(job);
    },
  });
  expect(await dispatcher.runOnce()).toBe(1);
  expect(jobs).toEqual([{ eventId: row.id, workspaceId: row.workspaceId, schemaVersion: 1 }]);
  expect(actions).toEqual([['queued', row.id]]);
});

test('malformed records are quarantined without blocking a later valid record', async () => {
  const { row, repository, actions, setClaims } = fixture();
  setClaims([{ ...row, id: randomUUID() }, row]);
  const jobs = [];
  const dispatcher = createOutboxDispatcher(repository, {
    publish: async (job) => {
      jobs.push(job);
    },
  });
  expect(await dispatcher.runOnce()).toBe(1);
  expect(actions.filter(([kind]) => kind === 'quarantine')).toHaveLength(1);
  expect(jobs).toHaveLength(1);
});

test('queue outages and lost acknowledgments retain retry intent with bounded delay', async () => {
  for (const operation of ['publish', 'acknowledge']) {
    const { row, repository, actions } = fixture();
    row.attempts = 9999;
    if (operation === 'acknowledge')
      repository.markQueued = async () => {
        throw new Error('database disconnected');
      };

    const dispatcher = createOutboxDispatcher(repository, {
      publish: async () => {
        if (operation === 'publish') throw new Error('private error content');
      },
    });
    expect(await dispatcher.runOnce()).toBe(0);
    expect(actions).toEqual([['retry', row.id, { code: 'DISPATCH_RETRY', delayMs: 60000 }]]);
  }
  expect(retryDelay(1)).toBe(250);
  expect(retryDelay(Number.MAX_SAFE_INTEGER)).toBe(60000);
});

test('stale acknowledgments never overwrite a new owner and concurrent cycles coalesce', async () => {
  const { repository, actions } = fixture();
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  repository.markQueued = async () => false;
  const dispatcher = createOutboxDispatcher(repository, { publish: async () => gate });
  const first = dispatcher.runOnce();
  const second = dispatcher.runOnce();
  release();
  expect(await first).toBe(0);
  expect(await second).toBe(0);
  expect(actions).toEqual([]);
});

test('the Nest lifecycle starts and closes a supplied dispatcher while spec-only bootstrap is inert', async () => {
  const calls = [];
  const probe = {
    check: async () => {
      throw new Error('Spec bootstrap must not probe dependencies');
    },
    close: async () => {},
  };
  const spec = await createApplication(probe);
  try {
    expect(spec.document.paths['/v1/tasks/{taskId}']).toBeDefined();
    expect(calls).toEqual([]);
  } finally {
    await spec.app.close();
  }

  const runtime = {
    start: () => calls.push('start'),
    close: async () => {
      calls.push('close');
    },
  };
  const { app } = await createApplication(probe, { outbox: runtime });
  try {
    expect(calls).toEqual([]);
    await app.init();
    expect(calls).toEqual(['start']);
  } finally {
    await app.close();
  }
  expect(calls).toEqual(['start', 'close']);
});
