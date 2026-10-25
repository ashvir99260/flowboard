import assert from 'node:assert/strict';
import test from 'node:test';

import { getTask } from '@flowboard/api-client/sdk';

const session = (token = 'old-token', workspaceId = '10000000-0000-4000-8000-000000000002') => ({
  data: {
    accessToken: token,
    expiresAt: '2026-10-24T12:00:00.000Z',
    user: {
      createdAt: '2026-10-24T10:00:00.000Z',
      email: 'alice@example.com',
      id: '10000000-0000-4000-8000-000000000001',
      name: 'Alice',
      updatedAt: '2026-10-24T10:00:00.000Z',
    },
    activeWorkspace: {
      archivedAt: null,
      id: workspaceId,
      name: 'Workspace',
      role: 'admin',
      createdAt: '2026-10-24T10:00:00.000Z',
      updatedAt: '2026-10-24T10:00:00.000Z',
    },
  },
});
const unauthorized = () =>
  globalThis.Response.json(
    { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
    { status: 401 },
  );
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });

  return { promise, resolve };
};

test(
  'concurrent bearer401s share one refresh and retry with the new token',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const refreshStarted = deferred();
    const finishRefresh = deferred();
    let refreshes = 0;
    const tokens = [];
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async (request) => {
        if (request.url.endsWith('/auth/refresh')) {
          refreshes++;
          assert.equal(request.headers.get('Cookie'), null);
          assert.equal(request.credentials, 'include');
          refreshStarted.resolve();
          await finishRefresh.promise;

          return globalThis.Response.json(session('new-token'));
        }

        tokens.push(request.headers.get('Authorization'));

        return request.headers.get('Authorization') === 'Bearer new-token'
          ? globalThis.Response.json({ ok: true })
          : unauthorized();
      },
    });
    const first = getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true });
    const second = getTask({ client: runtime.client, path: { taskId: 'two' }, throwOnError: true });
    await refreshStarted.promise;
    finishRefresh.resolve();
    await Promise.all([first, second]);
    assert.equal(refreshes, 1);
    assert.deepEqual(
      tokens.sort(),
      ['Bearer new-token', 'Bearer new-token', 'Bearer old-token', 'Bearer old-token'].sort(),
    );
    runtime.dispose();
  },
);

test(
  'a late old-token401 retries without rotating the cookie again',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const late = deferred();
    let refreshes = 0;
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async (request) => {
        if (request.url.endsWith('/auth/refresh')) {
          refreshes++;

          return globalThis.Response.json(session('new-token'));
        }

        if (request.headers.get('Authorization') === 'Bearer new-token')
          return globalThis.Response.json({ ok: true });

        if (request.url.endsWith('/late')) await late.promise;

        return unauthorized();
      },
    });
    const delayed = getTask({
      client: runtime.client,
      path: { taskId: 'late' },
      throwOnError: true,
    });
    await getTask({ client: runtime.client, path: { taskId: 'fast' }, throwOnError: true });
    late.resolve();
    await delayed;
    assert.equal(refreshes, 1);
    runtime.dispose();
  },
);

test(
  'a request preparing under an old authority never reaches the network',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const preparing = deferred();
    const release = deferred();
    let requests = 0;
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async () => {
        requests++;

        return globalThis.Response.json({ ok: true });
      },
    });
    const pending = getTask({
      client: runtime.client,
      path: { taskId: 'old-workspace-task' },
      throwOnError: true,
      requestValidator: async () => {
        preparing.resolve();
        await release.promise;
      },
    });
    await preparing.promise;
    runtime.setSession(session('new-token', '10000000-0000-4000-8000-000000000003'));
    release.resolve();
    await assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
    assert.equal(requests, 0);
    runtime.dispose();
  },
);

test(
  'logout while a JSON body is streaming discards the parsed result',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const reading = deferred();
    let controller;
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async () =>
        new globalThis.Response(
          new globalThis.ReadableStream(
            {
              start(value) {
                controller = value;
              },
              pull() {
                reading.resolve();
              },
            },
            { highWaterMark: 0 },
          ),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    });
    const pending = getTask({
      client: runtime.client,
      path: { taskId: 'one' },
      throwOnError: true,
    });
    await reading.promise;
    runtime.clearSession();
    controller.enqueue(new globalThis.TextEncoder().encode('{"private":"old workspace"}'));
    controller.close();
    await assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
    runtime.dispose();
  },
);

test(
  'the retry preserves a generated per-request fetch override',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    let requests = 0;
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async (request) => {
        assert.ok(request.url.endsWith('/auth/refresh'));

        return globalThis.Response.json(session('new-token'));
      },
    });
    await getTask({
      client: runtime.client,
      path: { taskId: 'one' },
      throwOnError: true,
      fetch: async (request) => {
        requests++;

        return request.headers.get('Authorization') === 'Bearer old-token'
          ? unauthorized()
          : globalThis.Response.json({ ok: true });
      },
    });
    assert.equal(requests, 2);
    runtime.dispose();
  },
);

test('workspace switching fails before cookie writes without cross-tab coordination', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const { createLocalSessionSync } = await import('../dist/session-sync.js');
  let requests = 0;
  const destination = '10000000-0000-4000-8000-000000000003';
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    sync: createLocalSessionSync(false),
    fetch: async () => {
      requests++;

      return globalThis.Response.json(session('new', destination));
    },
  });
  await assert.rejects(
    runtime.switchWorkspace(destination),
    (error) => error.code === 'COORDINATION_UNAVAILABLE',
  );
  assert.equal(requests, 0);
  runtime.dispose();
});

test('switch response must belong to the initiating user', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const destination = '10000000-0000-4000-8000-000000000003';
  const wrong = session('wrong-user-token', destination);
  wrong.data.user.id = '10000000-0000-4000-8000-000000000004';
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async () => globalThis.Response.json(wrong),
  });
  await assert.rejects(
    runtime.switchWorkspace(destination),
    (error) => error.code === 'SESSION_CHANGED',
  );
  assert.equal(runtime.getSession(), null);
  runtime.dispose();
});

test('queued logout cannot revoke a later login cookie', { timeout: 10_000 }, async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const { createLocalSessionSync } = await import('../dist/session-sync.js');
  const sync = createLocalSessionSync();
  const release = deferred();
  const blocking = sync.exclusive(() => release.promise);
  let requests = 0;
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    sync,
    fetch: async () => {
      requests++;

      return new globalThis.Response(null, { status: 204 });
    },
  });
  const logout = runtime.logout();
  runtime.setSession(session('later-login'));
  release.resolve();
  await blocking;
  await assert.rejects(logout, (error) => error.code === 'SESSION_CHANGED');
  assert.equal(requests, 0);
  assert.equal(runtime.getSession().data.accessToken, 'later-login');
  runtime.dispose();
});

test('a retried mutation preserves its body and stops after a second401', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const { createTask } = await import('@flowboard/api-client/sdk');
  const bodies = [];
  let refreshes = 0;
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async (request) => {
      if (request.url.endsWith('/auth/refresh')) {
        refreshes++;

        return globalThis.Response.json(session('new'));
      }

      bodies.push(await request.json());

      return unauthorized();
    },
  });
  const body = {
    title: 'Keep this body',
    statusId: 'status',
    expectedConfigVersion: 1,
    customFields: { effort: 0 },
  };
  await assert.rejects(
    createTask({ client: runtime.client, path: { listId: 'list' }, body, throwOnError: true }),
    (error) => error.code === 'UNAUTHENTICATED',
  );
  await assert.rejects(
    getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true }),
    (error) => error.code === 'UNAUTHENTICATED',
  );
  assert.deepEqual(bodies, [body, body]);
  assert.equal(refreshes, 1);
  assert.equal(runtime.getSession(), null);
  runtime.dispose();
});

for (const failure of ['forbidden', 'network']) {
  test(`${failure} failures never initiate refresh`, async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const requests = [];
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async (request) => {
        requests.push(request.url);
        if (failure === 'network') throw new TypeError('offline');

        return globalThis.Response.json(
          { error: { code: 'FORBIDDEN', message: 'Denied' } },
          { status: 403 },
        );
      },
    });
    await assert.rejects(
      getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true }),
    );
    assert.deepEqual(requests, ['https://api.example.com/v1/tasks/one']);
    assert.equal(runtime.getSession().data.accessToken, 'old-token');
    runtime.dispose();
  });
}

test('aborting one refresh waiter does not cancel the others', { timeout: 10_000 }, async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const started = deferred();
  const finish = deferred();
  let refreshes = 0;
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async (request) => {
      if (request.url.endsWith('/auth/refresh')) {
        refreshes++;
        started.resolve();
        await finish.promise;

        return globalThis.Response.json(session('new'));
      }

      return request.headers.get('Authorization') === 'Bearer new'
        ? globalThis.Response.json({ ok: true })
        : unauthorized();
    },
  });
  const controller = new AbortController();
  const first = getTask({
    client: runtime.client,
    path: { taskId: 'one' },
    signal: controller.signal,
    throwOnError: true,
  });
  const second = getTask({ client: runtime.client, path: { taskId: 'two' }, throwOnError: true });
  await started.promise;
  controller.abort();
  await assert.rejects(first, (error) => error.name === 'AbortError');
  finish.resolve();
  await second;
  assert.equal(refreshes, 1);
  runtime.dispose();
});

test(
  'logout during refresh cannot restore tokens or replay the old request',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const started = deferred();
    const finish = deferred();
    let protectedRequests = 0;
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async (request) => {
        if (request.url.endsWith('/auth/refresh')) {
          started.resolve();
          await finish.promise;

          return globalThis.Response.json(session('new'));
        }

        protectedRequests++;

        return unauthorized();
      },
    });
    const pending = getTask({
      client: runtime.client,
      path: { taskId: 'one' },
      throwOnError: true,
    });
    await started.promise;
    runtime.clearSession();
    finish.resolve();
    await assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
    assert.equal(protectedRequests, 1);
    assert.equal(runtime.getSession(), null);
    runtime.dispose();
  },
);

for (const mismatch of ['user', 'workspace']) {
  test(`refresh rejects a changed ${mismatch} identity`, async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const changed = session('foreign');
    if (mismatch === 'user') changed.data.user.id = '10000000-0000-4000-8000-000000000004';
    else changed.data.activeWorkspace.id = '10000000-0000-4000-8000-000000000005';

    let requests = 0;
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async (request) => {
        requests++;

        return request.url.endsWith('/auth/refresh')
          ? globalThis.Response.json(changed)
          : unauthorized();
      },
    });
    await assert.rejects(
      getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true }),
      (error) => error.code === 'SESSION_CHANGED',
    );
    assert.equal(requests, 2);
    assert.equal(runtime.getSession(), null);
    runtime.dispose();
  });
}

test(
  'two tabs serialize refresh exchanges while retaining their own access tokens',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const { createLocalSessionSync } = await import('../dist/session-sync.js');
    const sync = createLocalSessionSync();
    let active = 0;
    let maximum = 0;
    let refreshes = 0;
    const fetch = async (request) => {
      if (request.url.endsWith('/auth/refresh')) {
        active++;
        maximum = Math.max(maximum, active);
        const token = `new-${++refreshes}`;
        await new Promise((resolve) => setTimeout(resolve, 5));
        active--;

        return globalThis.Response.json(session(token));
      }

      return request.headers.get('Authorization') === 'Bearer old-token'
        ? unauthorized()
        : globalThis.Response.json({ ok: true });
    };
    const first = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      sync,
      fetch,
    });
    const second = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      sync,
      fetch,
    });
    await Promise.all(
      [first, second].map((runtime) =>
        getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true }),
      ),
    );
    assert.equal(maximum, 1);
    assert.equal(refreshes, 2);
    assert.notEqual(first.getSession().data.accessToken, second.getSession().data.accessToken);
    first.dispose();
    second.dispose();
  },
);

test(
  'cross-tab A-to-B-to-A changes invalidate an earlier A request',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const { createLocalSessionSync } = await import('../dist/session-sync.js');
    const sync = createLocalSessionSync();
    const started = deferred();
    const finish = deferred();
    const options = {
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      sync,
      fetch: async () => {
        started.resolve();
        await finish.promise;

        return globalThis.Response.json({ private: true });
      },
    };
    const first = setupClient(options);
    const second = setupClient(options);
    const pending = getTask({ client: second.client, path: { taskId: 'one' }, throwOnError: true });
    await started.promise;
    first.setSession(session('B', '10000000-0000-4000-8000-000000000003'));
    first.setSession(session('A-again'));
    finish.resolve();
    await assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
    assert.equal(second.getSession(), null);
    first.dispose();
    second.dispose();
  },
);

test('server-side instances and returned snapshots never share mutable token state', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const tokens = [];
  const options = {
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    fetch: async (request) => {
      tokens.push(request.headers.get('Authorization'));

      return globalThis.Response.json({ ok: true });
    },
  };
  const first = setupClient({ ...options, initialSession: session('first') });
  const second = setupClient({ ...options, initialSession: session('second') });
  const snapshot = first.getSession();
  snapshot.data.accessToken = 'tampered';
  first.clearSession();
  await getTask({ client: second.client, path: { taskId: 'one' }, throwOnError: true });
  assert.deepEqual(tokens, ['Bearer second']);
  assert.equal(second.getSession().data.accessToken, 'second');
  first.dispose();
  second.dispose();
});

test(
  'login joins the cookie lock and supersedes an older pending refresh',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const started = deferred();
    const finish = deferred();
    let logins = 0;
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async (request) => {
        if (request.url.endsWith('/auth/refresh')) {
          started.resolve();
          await finish.promise;

          return globalThis.Response.json(session('old-refresh'));
        }

        if (request.url.endsWith('/auth/login')) {
          logins++;
          assert.equal(request.headers.get('Cookie'), null);

          return globalThis.Response.json(session('logged-in'));
        }

        return unauthorized();
      },
    });
    const pending = getTask({
      client: runtime.client,
      path: { taskId: 'one' },
      throwOnError: true,
    });
    await started.promise;
    const login = runtime.login({ email: 'alice@example.com', password: 'password-value' });
    assert.equal(logins, 0);
    finish.resolve();
    await assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
    await login;
    assert.equal(runtime.getSession().data.accessToken, 'logged-in');
    assert.equal(logins, 1);
    runtime.dispose();
  },
);

test('signup applies a new session through the generated public endpoint', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    fetch: async (request) => {
      assert.equal(request.url, 'https://api.example.com/v1/auth/signup');
      assert.equal(request.headers.get('Authorization'), null);
      assert.equal(request.headers.get('Cookie'), null);

      return globalThis.Response.json(session('signed-up'));
    },
  });
  await runtime.signup({
    email: 'alice@example.com',
    name: 'Alice',
    password: 'password-value',
    workspaceName: 'Personal',
  });
  assert.equal(runtime.getSession().data.accessToken, 'signed-up');
  runtime.dispose();
});

test('switch retries once after refresh and retains source identity checks', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const destination = '10000000-0000-4000-8000-000000000003';
  const calls = [];
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async (request) => {
      calls.push(request.url);
      if (request.url.endsWith('/auth/refresh'))
        return globalThis.Response.json(session('refreshed'));

      if (request.headers.get('Authorization') === 'Bearer old-token') return unauthorized();

      assert.equal(request.headers.get('Authorization'), 'Bearer refreshed');

      return globalThis.Response.json(session('switched', destination));
    },
  });
  await runtime.switchWorkspace(destination);
  assert.equal(calls.length, 3);
  assert.equal(runtime.getSession().data.activeWorkspace.id, destination);
  assert.equal(runtime.getSession().data.accessToken, 'switched');
  runtime.dispose();
});

test('wrong-user refresh during switch cannot authorize a second switch request', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const wrong = session('wrong');
  wrong.data.user.id = '10000000-0000-4000-8000-000000000004';
  let switches = 0;
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async (request) => {
      if (request.url.endsWith('/auth/refresh')) return globalThis.Response.json(wrong);

      switches++;

      return unauthorized();
    },
  });
  await assert.rejects(
    runtime.switchWorkspace('10000000-0000-4000-8000-000000000003'),
    (error) => error.code === 'SESSION_CHANGED',
  );
  assert.equal(switches, 1);
  assert.equal(runtime.getSession(), null);
  runtime.dispose();
});

test('aborted requests never reach the network or refresh', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  let requests = 0;
  const controller = new AbortController();
  controller.abort();
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async () => {
      requests++;

      return unauthorized();
    },
  });
  await assert.rejects(
    getTask({
      client: runtime.client,
      path: { taskId: 'one' },
      signal: controller.signal,
      throwOnError: true,
    }),
    (error) => error.name === 'AbortError',
  );
  assert.equal(requests, 0);
  runtime.dispose();
});

test('terminal refresh failure remains closed when TanStack retries the query', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const { QueryClient } = await import('@tanstack/react-query');
  const { getTaskOptions } = await import('@flowboard/api-client/tanstack-query');
  let requests = 0;
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async () => {
      requests++;

      return unauthorized();
    },
  });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: 2, retryDelay: 0 } } });
  await assert.rejects(
    cache.fetchQuery(getTaskOptions({ client: runtime.client, path: { taskId: 'one' } })),
  );
  assert.equal(requests, 2);
  assert.equal(runtime.getSession(), null);
  cache.clear();
  runtime.dispose();
});

test(
  'aborting during body parsing cannot return a late successful result',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const reading = deferred();
    const abort = new AbortController();
    let controller;
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async () =>
        new globalThis.Response(
          new globalThis.ReadableStream(
            {
              start(value) {
                controller = value;
              },
              pull() {
                reading.resolve();
              },
            },
            { highWaterMark: 0 },
          ),
          { headers: { 'Content-Type': 'application/json' } },
        ),
    });
    const pending = getTask({
      client: runtime.client,
      path: { taskId: 'one' },
      signal: abort.signal,
      throwOnError: true,
    });
    await reading.promise;
    abort.abort();
    controller.enqueue(new globalThis.TextEncoder().encode('{"ok":true}'));
    controller.close();
    await assert.rejects(pending, (error) => error.name === 'AbortError');
    runtime.dispose();
  },
);

test('malformed successful refresh fails closed without retrying the mutation', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  let requests = 0;
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async (request) => {
      requests++;

      return request.url.endsWith('/auth/refresh')
        ? globalThis.Response.json({ data: {} })
        : unauthorized();
    },
  });
  await assert.rejects(
    getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true }),
    (error) => error.code === 'UNAUTHENTICATED',
  );
  assert.equal(requests, 2);
  assert.equal(runtime.getSession(), null);
  runtime.dispose();
});

test(
  'a stale failed response cannot report errors into a newer session',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const reading = deferred();
    let controller;
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      fetch: async () =>
        new globalThis.Response(
          new globalThis.ReadableStream(
            {
              start(value) {
                controller = value;
              },
              pull() {
                reading.resolve();
              },
            },
            { highWaterMark: 0 },
          ),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        ),
    });
    const pending = getTask({
      client: runtime.client,
      path: { taskId: 'one' },
      throwOnError: true,
    });
    await reading.promise;
    runtime.clearSession();
    controller.enqueue(
      new globalThis.TextEncoder().encode(
        '{"error":{"code":"BAD_REQUEST","message":"Old form error"}}',
      ),
    );
    controller.close();
    await assert.rejects(pending, (error) => error.code === 'SESSION_CHANGED');
    runtime.dispose();
  },
);

test(
  'an old refresh failure cannot publish expiry over another tab session',
  { timeout: 10_000 },
  async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const started = deferred();
    const release = deferred();
    let revision = 'initial';
    let publications = 0;
    const sync = {
      available: true,
      version: () => revision,
      subscribe: () => () => {},
      exclusive: async (work) => work(),
      bump: () => {
        publications++;
        revision = `local-${publications}`;

        return revision;
      },
    };
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      sync,
      fetch: async (request) => {
        if (!request.url.endsWith('/auth/refresh')) return unauthorized();

        started.resolve();
        await release.promise;
        throw new TypeError('Network failure');
      },
    });
    const pending = getTask({
      client: runtime.client,
      path: { taskId: 'one' },
      throwOnError: true,
    });
    await started.promise;
    revision = 'another-tab-login';
    release.resolve();
    await assert.rejects(pending);
    assert.equal(publications, 0);
    assert.equal(revision, 'another-tab-login');
    assert.equal(runtime.getSession(), null);
    runtime.dispose();
  },
);

test('uppercase workspace IDs use the canonical destination returned by the API', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  const destination = 'abcdefab-cdef-4abc-8abc-abcdefabcdef';
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async () => globalThis.Response.json(session('switched', destination)),
  });
  await runtime.switchWorkspace(destination.toUpperCase());
  assert.equal(runtime.getSession().data.activeWorkspace.id, destination);
  runtime.dispose();
});

for (const method of ['getItem', 'setItem']) {
  test(`browser storage ${method} failure clears the consumer session without HTTP`, async () => {
    const { setupClient } = await import('@flowboard/api-client/session');
    const values = new Map();
    const browser = new globalThis.EventTarget();
    browser.localStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    browser.navigator = { locks: { request: async (_name, work) => work() } };
    Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
    let requests = 0;
    const changes = [];
    const runtime = setupClient({
      baseUrl: 'https://api.example.com',
      origin: 'https://web.example.com',
      initialSession: session(),
      onSessionChange: (value) => changes.push(value),
      fetch: async () => {
        requests++;

        return globalThis.Response.json(session());
      },
    });
    try {
      browser.localStorage[method] = () => {
        throw new Error('Storage disabled');
      };
      if (method === 'setItem') runtime.clearSession();

      await assert.rejects(
        getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true }),
      );
      assert.equal(runtime.getSession(), null);
      assert.equal(changes.at(-1), null);
      assert.equal(requests, 0);
    } finally {
      runtime.dispose();
      delete globalThis.window;
    }
  });
}

test('a disposed client cannot be revived or issue another request', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  let requests = 0;
  const runtime = setupClient({
    baseUrl: 'https://api.example.com',
    origin: 'https://web.example.com',
    initialSession: session(),
    fetch: async () => {
      requests++;

      return globalThis.Response.json({});
    },
  });
  runtime.dispose();
  assert.throws(
    () => runtime.setSession(session()),
    (error) => error.code === 'UNAUTHENTICATED',
  );
  await assert.rejects(
    getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true }),
    (error) => error.code === 'UNAUTHENTICATED',
  );
  assert.equal(requests, 0);
  runtime.dispose();
});

test('browser clients default to the current web origin proxy', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'https://web.example.test' } },
  });
  const requests = [];
  const runtime = setupClient({
    initialSession: session(),
    fetch: async (request) => {
      requests.push(request.url);

      return globalThis.Response.json({ ok: true });
    },
  });
  try {
    await getTask({ client: runtime.client, path: { taskId: 'one' }, throwOnError: true });
    assert.deepEqual(requests, ['https://web.example.test/api/v1/tasks/one']);
  } finally {
    runtime.dispose();
    delete globalThis.window;
  }
});

test('server-side clients require explicit request-scoped origins', async () => {
  const { setupClient } = await import('@flowboard/api-client/session');
  assert.throws(() => setupClient({}), /origins/);
});
