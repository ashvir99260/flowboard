// HTTP contract fixture for browser state/race tests. Real authorization stays in API/Postgres suites.
import {
  AuthExamples,
  LogInSchema,
  NodeExamples,
  NodeSchema,
  SessionEnvelopeSchema,
  SignUpSchema,
  TreePageSchema,
} from '@flowboard/contracts';

import { createBoardApi } from './board-api-fixture.mjs';
import { startUpstream } from './proxy-fixture.mjs';

export async function startAppApi(t) {
  const cookies = new Map();
  const access = new Map();
  const requests = [];
  const controls = {
    logoutFailures: 0,
    malformedTree: false,
    nodeGate: null,
    treeAlwaysStale: false,
    treeStaleRemaining: 0,
    wrongNodeId: null,
  };
  let sequence = 0;
  const workspace = { ...AuthExamples.session.data.activeWorkspace, name: 'Engineering' };
  const secondWorkspace = {
    ...workspace,
    id: '10000000-0000-4000-8000-000000000003',
    name: 'Research',
  };
  const createNode = (suffix, type, name, parentId, owner = workspace.id) =>
    NodeSchema.parse({
      ...NodeExamples.node,
      id: `20000000-0000-4000-8000-0000000000${suffix}`,
      type,
      name,
      parentId,
      workspaceId: owner,
    });
  const space = createNode('11', 'space', 'Product', null);
  const folder = createNode('12', 'folder', 'Roadmap', space.id);
  const publicList = createNode('13', 'list', 'Public list', folder.id);
  const privateList = {
    ...createNode('14', 'list', 'Private list', folder.id),
    visibility: 'private',
  };
  const researchSpace = createNode('21', 'space', 'Discovery', null, secondWorkspace.id);
  const researchFolder = createNode('22', 'folder', 'Ideas', researchSpace.id, secondWorkspace.id);
  const researchList = createNode(
    '23',
    'list',
    'Research plan',
    researchFolder.id,
    secondWorkspace.id,
  );
  const allNodes = [
    space,
    folder,
    publicList,
    privateList,
    researchSpace,
    researchFolder,
    researchList,
  ];
  const board = createBoardApi(allNodes);
  controls.board = board.controls;
  const send = (response, status, value) =>
    response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(value));
  const issue = (response, user, activeWorkspace = workspace, status = 200) => {
    const cookie = `fixture-cookie-${++sequence}`;
    const session = SessionEnvelopeSchema.parse({
      data: {
        accessToken: `fixture-access-${sequence}`,
        expiresAt: new Date(Date.now() + 900000).toISOString(),
        user,
        activeWorkspace,
      },
    });
    cookies.set(cookie, session);
    access.set(session.data.accessToken, session);
    response.setHeader('Set-Cookie', `flowboard_refresh=${cookie}; HttpOnly; Path=/; SameSite=Lax`);
    send(response, status, session);
  };
  const origin = await startUpstream(t, async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      requests.push({
        path: url.pathname,
        method: request.method,
        query: Object.fromEntries(url.searchParams),
      });
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
      if (url.pathname.startsWith('/v1/tasks/')) requests.at(-1).body = body;

      const cookie = request.headers.cookie?.match(/flowboard_refresh=([^;]+)/)?.[1];
      const session = access.get(request.headers.authorization?.replace(/^Bearer /, ''));
      if (url.pathname === '/v1/auth/login') {
        const parsed = LogInSchema.safeParse(body);
        if (!parsed.success || parsed.data.password !== 'browser-test-password')
          return send(response, 401, {
            error: { code: 'UNAUTHENTICATED', message: 'Invalid email or password' },
          });

        return issue(
          response,
          {
            ...AuthExamples.session.data.user,
            id: parsed.data.email.startsWith('bob')
              ? '10000000-0000-4000-8000-000000000004'
              : AuthExamples.session.data.user.id,
            email: parsed.data.email,
            name: parsed.data.email.startsWith('bob') ? 'Bob' : 'Alice',
          },
          { ...workspace, role: parsed.data.email.startsWith('bob') ? 'member' : 'admin' },
        );
      }

      if (url.pathname === '/v1/auth/signup') {
        const parsed = SignUpSchema.parse(body);

        return issue(
          response,
          { ...AuthExamples.session.data.user, name: parsed.name, email: parsed.email },
          { ...workspace, name: parsed.workspaceName },
          201,
        );
      }

      if (url.pathname === '/v1/auth/refresh') {
        const previous = cookies.get(cookie);
        if (!previous)
          return send(response, 401, {
            error: { code: 'SESSION_EXPIRED', message: 'Session expired' },
          });

        cookies.delete(cookie);

        return issue(response, previous.data.user, previous.data.activeWorkspace);
      }

      if (url.pathname === '/v1/auth/logout') {
        if (controls.logoutFailures > 0) {
          controls.logoutFailures--;

          return send(response, 503, {
            error: { code: 'INTERNAL_ERROR', message: 'Test service unavailable' },
          });
        }

        cookies.delete(cookie);
        response.setHeader(
          'Set-Cookie',
          'flowboard_refresh=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0',
        );
        response.writeHead(204).end();

        return;
      }

      if (!session)
        return send(response, 401, {
          error: { code: 'UNAUTHENTICATED', message: 'Sign in to continue' },
        });

      if (await board.respond({ url, session, response, body, method: request.method })) return;

      if (url.pathname === '/v1/me')
        return send(response, 200, {
          data: { user: session.data.user, activeWorkspace: session.data.activeWorkspace },
        });

      if (url.pathname === '/v1/auth/switch-workspace') {
        const target = [workspace, secondWorkspace].find((item) => item.id === body.workspaceId);
        if (!target || (session.data.user.name === 'Bob' && target.id === secondWorkspace.id))
          return send(response, 403, {
            error: { code: 'FORBIDDEN', message: 'Workspace access denied' },
          });

        cookies.delete(cookie);

        return issue(response, session.data.user, target);
      }

      if (url.pathname === '/v1/workspaces') {
        const more = session.data.user.name === 'Alice' && !url.searchParams.has('cursor');

        return send(response, 200, {
          items: [url.searchParams.has('cursor') ? secondWorkspace : session.data.activeWorkspace],
          pageInfo: { hasNextPage: more, nextCursor: more ? 'workspaces-next' : null },
        });
      }

      if (url.pathname === '/v1/tree') {
        if (controls.malformedTree) return send(response, 200, { items: [] });

        if (
          url.searchParams.has('cursor') &&
          (controls.treeAlwaysStale || controls.treeStaleRemaining > 0)
        ) {
          controls.treeStaleRemaining--;

          return send(response, 409, {
            error: { code: 'CURSOR_STALE', message: 'Navigation changed. Restart the page.' },
          });
        }

        const nodes = allNodes.filter(
          (node) =>
            node.workspaceId === session.data.activeWorkspace.id &&
            (node.visibility !== 'private' || session.data.user.name !== 'Bob'),
        );
        const next = !url.searchParams.has('cursor');

        return send(
          response,
          200,
          TreePageSchema.parse({
            items: next ? nodes.slice(0, 2) : nodes.slice(2),
            root: {
              id: session.data.activeWorkspace.id,
              name: session.data.activeWorkspace.name,
              type: 'workspace',
            },
            pageInfo: { hasNextPage: next, nextCursor: next ? 'tree-next' : null },
            configVersion: 1,
            dataVersion: 1,
          }),
        );
      }

      if (url.pathname.startsWith('/v1/nodes/')) {
        if (controls.nodeGate) await controls.nodeGate;

        const node = allNodes.find(
          (item) =>
            item.id === url.pathname.split('/').at(-1) &&
            item.workspaceId === session.data.activeWorkspace.id,
        );
        if (!node)
          return send(response, 404, { error: { code: 'NOT_FOUND', message: 'List not found' } });

        if (node.visibility === 'private' && session.data.user.name === 'Bob')
          return send(response, 403, { error: { code: 'FORBIDDEN', message: 'Access denied' } });

        return send(response, 200, {
          data: { ...node, id: controls.wrongNodeId ?? node.id },
          configVersion: 1,
          dataVersion: 1,
        });
      }

      return send(response, 501, {
        error: { code: 'INTERNAL_ERROR', message: 'Unsupported fixture route' },
      });
    } catch {
      send(response, 400, {
        error: { code: 'VALIDATION_FAILED', message: 'Invalid fixture request' },
      });
    }
  });

  return {
    origin,
    requests,
    cookies,
    access,
    controls,
    workspace,
    secondWorkspace,
    publicList,
    privateList,
    researchList,
  };
}
