import {
  ResolvedFieldCollectionSchema,
  ResolvedStatusCollectionSchema,
  TaskPageSchema,
} from '@flowboard/contracts';

import { boardFixture, ids, status, task } from './board-fixture.mjs';

export function createBoardApi(nodes) {
  let cursorSequence = 0;
  const issuedCursors = new Map();
  const controls = {
    driftRounds: 0,
    empty: false,
    error: null,
    malformed: false,
    publicGate: null,
    staleCursorOnce: false,
  };
  const send = (response, statusCode, data) =>
    response
      .writeHead(statusCode, { 'Content-Type': 'application/json' })
      .end(JSON.stringify(data));
  const respond = async ({ url, session, response }) => {
    const match = /^\/v1\/lists\/([^/]+)\/(resolved-statuses|resolved-fields|tasks)$/.exec(
      url.pathname,
    );
    if (!match) return false;

    const [, listId, kind] = match;
    const node = nodes.find(
      (item) => item.id === listId && item.workspaceId === session.data.activeWorkspace.id,
    );
    if (!node || controls.error === 'NOT_FOUND') {
      send(response, 404, { error: { code: 'NOT_FOUND', message: 'List not found' } });

      return true;
    }

    if (
      (node.visibility === 'private' && session.data.user.name === 'Bob') ||
      controls.error === 'FORBIDDEN'
    ) {
      send(response, 403, { error: { code: 'FORBIDDEN', message: 'Access denied' } });

      return true;
    }

    if (controls.publicGate && node.name === 'Public list') await controls.publicGate;

    const fixture = boardFixture();
    const privateList = node.visibility === 'private';
    const statuses = fixture.statuses.items.map((item) => ({
      ...item,
      workspaceId: node.workspaceId,
      name: privateList ? { active: 'Working', done: 'Done', todo: 'Ready' }[item.key] : item.name,
    }));
    if (privateList) statuses.push(status(ids.closed, 'closed', 'closed', 3, 'Released'));

    const fields = fixture.fields.items.map((item) => ({
      ...item,
      workspaceId: node.workspaceId,
      ownerId: node.workspaceId,
      source: { ...item.source, ownerId: node.workspaceId },
      name: item.key === 'effort' ? 'Effort' : 'Area',
    }));
    if (kind === 'resolved-statuses') {
      send(
        response,
        200,
        controls.malformed
          ? { items: [{ name: 'Broken' }], configVersion: 1 }
          : ResolvedStatusCollectionSchema.parse({ items: statuses, configVersion: 1 }),
      );

      return true;
    }

    if (kind === 'resolved-fields') {
      send(response, 200, ResolvedFieldCollectionSchema.parse({ items: fields, configVersion: 1 }));

      return true;
    }

    const statusId = url.searchParams.get('statusId');
    if (
      !statusId ||
      url.searchParams.get('sort') !== 'manual' ||
      url.searchParams.get('direction') !== 'asc'
    ) {
      send(response, 400, {
        error: { code: 'VALIDATION_FAILED', message: 'Use per-column manual queries' },
      });

      return true;
    }

    const cursor = url.searchParams.get('cursor');
    if (cursor && controls.staleCursorOnce) {
      controls.staleCursorOnce = false;
      send(response, 409, { error: { code: 'CURSOR_STALE', message: 'Board changed' } });

      return true;
    }

    const offset = privateList ? 100 : 0;
    const title = privateList ? 'Private board task' : 'Public board task'.padEnd(500, 'x');
    const scope = { workspaceId: node.workspaceId, primaryListId: node.id };
    const allTasks = controls.empty
      ? []
      : [
          task(offset + 1, ids.todo, 0, {
            ...scope,
            title,
            priority: 'urgent',
            dueDate: '2026-11-01',
            assigneeIds: [session.data.user.id],
            assignees: [{ id: session.data.user.id, name: session.data.user.name }],
          }),
          task(offset + 2, ids.todo, 7, { ...scope, title: 'Review navigation' }),
          task(offset + 4, ids.todo, 90, { ...scope, title: 'Next page task' }),
          task(offset + 3, ids.active, 0, { ...scope, title: 'Active task' }),
        ].filter((item) => item.statusId === statusId);
    const owner = `${node.id}:${statusId}`;
    if (cursor && issuedCursors.get(cursor) !== owner) {
      send(response, 400, {
        error: { code: 'INVALID_CURSOR', message: 'Cursor crossed a column' },
      });

      return true;
    }

    const nextCursor =
      !cursor && allTasks.length > 2 ? `board:${owner}:2:${++cursorSequence}` : null;
    if (nextCursor) issuedCursors.set(nextCursor, owner);

    const drift = statusId === ids.done && controls.driftRounds > 0;
    if (drift) controls.driftRounds--;

    send(
      response,
      200,
      TaskPageSchema.parse({
        items: allTasks.slice(cursor ? 2 : 0, cursor ? 4 : 2),
        configVersion: 1,
        dataVersion: drift ? 2 : 1,
        pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
      }),
    );

    return true;
  };

  return { controls, respond };
}
