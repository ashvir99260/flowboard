// Isolated HTTP fixture for generated-client browser tests; runtime authorization lives in the API.
import {
  ActivityPageSchema,
  applyTaskFieldPatch,
  ArchiveTaskSchema,
  CreateTaskSchema,
  ListTasksQuerySchema,
  MemberPageSchema,
  MemberSchema,
  MoveTaskSchema,
  ReorderTaskSchema,
  ResolvedFieldCollectionSchema,
  ResolvedStatusCollectionSchema,
  TaskEnvelopeSchema,
  TaskMutationEnvelopeSchema,
  TaskPageSchema,
  UpdateTaskSchema,
} from '@flowboard/contracts';

import { boardFixture, field, ids, status, task } from './board-fixture.mjs';
import { sortedTableRows, tableFields, tableTasks } from './table-fixture.mjs';

export function createBoardApi(nodes) {
  let cursorSequence = 0;
  let dataVersion = 1;
  const issuedCursors = new Map();
  const tableCursors = new Map();
  const overrides = new Map();
  const controls = {
    activityPages: new Map(),
    activityGate: null,
    activityError: null,
    driftRounds: 0,
    empty: false,
    error: null,
    malformed: false,
    publicGate: null,
    staleCursorOnce: false,
    rejectNextMove: null,
    rejectMoves: new Map(),
    sourceFieldList: null,
    moveGates: new Map(),
    requiredDestination: null,
    tableMode: false,
    rejectNextWrite: null,
    writeGate: null,
    writeResponse: null,
    extraFields: false,
  };
  const send = (response, statusCode, data) =>
    response
      .writeHead(statusCode, { 'Content-Type': 'application/json' })
      .end(JSON.stringify(data));
  const error = (response, code, message, statusCode = 400, details) =>
    send(response, statusCode, { error: { code, message, ...(details ? { details } : {}) } });
  const visible = (node, session) =>
    node &&
    node.workspaceId === session.data.activeWorkspace.id &&
    !(node.visibility === 'private' && session.data.user.name === 'Bob');
  const fieldsFor = (node) => {
    if (controls.tableMode) {
      const fields = tableFields(node);
      if (controls.extraFields)
        fields.push(
          ...[
            { ...field('notes', 'text', false, 4), name: 'Notes' },
            { ...field('milestone', 'date', false, 5), name: 'Milestone' },
          ].map((item) => ({
            ...item,
            workspaceId: node.workspaceId,
            ownerId: node.workspaceId,
            source: { ...item.source, ownerId: node.workspaceId },
          })),
        );

      return fields;
    }

    const fields = boardFixture().fields.items.map((item) => ({
      ...item,
      workspaceId: node.workspaceId,
      ownerId: node.workspaceId,
      source: { ...item.source, ownerId: node.workspaceId },
      name: item.key === 'effort' ? 'Effort' : 'Area',
    }));
    if (controls.requiredDestination === node.id)
      fields.push(field('release_note', 'text', true, 2));

    if (controls.sourceFieldList === node.id) fields.push(field('legacy', 'text', false, 3));

    return fields;
  };
  const statusesFor = (node) => {
    const privateList = node.visibility === 'private';
    const statuses = boardFixture().statuses.items.map((item) => ({
      ...item,
      workspaceId: node.workspaceId,
      name: privateList ? { active: 'Working', done: 'Done', todo: 'Ready' }[item.key] : item.name,
    }));
    if (privateList) statuses.push(status(ids.closed, 'closed', 'closed', 3, 'Released'));

    return statuses;
  };
  const tasksFor = (node, session) => {
    const privateList = node.visibility === 'private';
    const offset = privateList ? 100 : 0;
    const scope = { workspaceId: node.workspaceId, primaryListId: node.id };
    const original = controls.tableMode
      ? tableTasks(node, session)
      : [
          task(offset + 1, ids.todo, 0, {
            ...scope,
            title: privateList ? 'Private board task' : 'Public board task'.padEnd(500, 'x'),
            priority: 'urgent',
            dueDate: '2026-11-01',
            assigneeIds: [session.data.user.id],
            assignees: [{ id: session.data.user.id, name: session.data.user.name }],
          }),
          task(offset + 2, ids.todo, 7, { ...scope, title: 'Review navigation' }),
          task(offset + 4, ids.todo, 90, { ...scope, title: 'Next page task' }),
          task(offset + 3, ids.active, 0, { ...scope, title: 'Active task' }),
        ];

    return [
      ...original
        .filter((item) => !overrides.has(item.id))
        .map((item) => ({
          ...item,
          customFields: {
            ...item.customFields,
            ...(controls.requiredDestination === node.id ? { release_note: 'Existing note' } : {}),
            ...(controls.sourceFieldList === node.id ? { legacy: 'Source value' } : {}),
          },
        })),
      ...[...overrides.values()].filter((item) => item.primaryListId === node.id),
    ]
      .filter((item) => item.archivedAt === null)
      .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
  };
  const writeTask = async ({ current, node, body, session, response }) => {
    if (controls.writeGate) await controls.writeGate;

    if (controls.rejectNextWrite) {
      const failure = controls.rejectNextWrite;
      controls.rejectNextWrite = null;
      error(response, failure.code, failure.message, failure.status, failure.details);

      return;
    }

    const parsed = (current ? UpdateTaskSchema : CreateTaskSchema).safeParse(body);
    if (!parsed.success)
      return error(
        response,
        'VALIDATION_FAILED',
        'Invalid task',
        400,
        parsed.error.issues.map(({ path, message, code }) => ({ path, message, code })),
      );

    const { expectedConfigVersion, expectedVersion, ...changes } = parsed.data;
    if (expectedConfigVersion !== 1 || (current && expectedVersion !== current.version))
      return error(response, 'VERSION_CONFLICT', 'Task changed. Reload it before saving.', 409);

    const fields = applyTaskFieldPatch({
      fields: fieldsFor(node),
      current: current?.customFields ?? {},
      patch: changes.customFields ?? {},
    });
    if (!fields.success)
      return error(response, 'FIELD_VALUE_INVALID', 'Check custom fields', 400, fields.issues);

    const assigneeIds = changes.assigneeIds ?? current?.assigneeIds ?? [];
    const saved = {
      ...(current ?? task(1000 + ++cursorSequence)),
      ...changes,
      workspaceId: node.workspaceId,
      primaryListId: node.id,
      customFields: fields.values,
      assigneeIds,
      assignees: assigneeIds.map((id) => ({
        id,
        name: id === session.data.user.id ? session.data.user.name : 'Workspace member',
      })),
      version: current ? current.version + 1 : 1,
    };
    overrides.set(saved.id, saved);
    dataVersion++;
    send(
      response,
      current ? 200 : 201,
      TaskMutationEnvelopeSchema.parse({
        data: { ...saved, ...controls.writeResponse },
        configVersion: 1,
        dataVersion,
        changedTaskIds: [saved.id],
      }),
    );
  };
  const mutate = async ({ taskId, kind, body, session, response }) => {
    const parsed = (kind === 'move' ? MoveTaskSchema : ReorderTaskSchema).safeParse(body);
    if (!parsed.success) return error(response, 'VALIDATION_FAILED', 'Invalid move request');

    await controls.moveGates.get(taskId);
    const rejection = controls.rejectMoves.get(taskId) ?? controls.rejectNextMove;
    if (rejection) {
      const code = rejection;
      if (controls.rejectMoves.has(taskId)) controls.rejectMoves.delete(taskId);
      else controls.rejectNextMove = null;

      return error(
        response,
        code,
        code === 'FORBIDDEN' ? 'Access denied' : 'Task changed. Refresh before retrying.',
        code === 'FORBIDDEN' ? 403 : 409,
      );
    }

    const scopedNodes = nodes.filter(
      (node) => node.type === 'list' && node.workspaceId === session.data.activeWorkspace.id,
    );
    const current = scopedNodes
      .flatMap((node) => tasksFor(node, session))
      .find((item) => item.id === taskId);
    if (!current) return error(response, 'NOT_FOUND', 'Task unavailable', 404);

    const source = nodes.find((node) => node.id === current.primaryListId);
    const destinationId = kind === 'move' ? parsed.data.destinationListId : current.primaryListId;
    const destination = nodes.find((node) => node.id === destinationId);
    if (!visible(source, session) || !visible(destination, session))
      return error(response, 'FORBIDDEN', 'Access denied', 403);

    if (parsed.data.expectedVersion !== current.version || parsed.data.expectedConfigVersion !== 1)
      return error(response, 'VERSION_CONFLICT', 'Task changed. Refresh before retrying.', 409);

    const statusId =
      kind === 'move' ? (parsed.data.statusId ?? current.statusId) : current.statusId;
    if (!statusesFor(destination).some((item) => item.id === statusId))
      return error(response, 'STATUS_NOT_AVAILABLE', 'Status unavailable');

    const values = applyTaskFieldPatch({
      current: current.customFields,
      fields: fieldsFor(destination),
      patch: parsed.data.customFields ?? {},
    });
    if (!values.success)
      return error(response, 'FIELD_VALUE_INVALID', 'Check destination fields', 400, values.issues);

    const destinationTasks = tasksFor(destination, session).filter(
      (item) => item.id !== taskId && item.statusId === statusId,
    );
    const placement = parsed.data.placement;
    const anchorId = placement.beforeId ?? placement.afterId;
    const anchorIndex = destinationTasks.findIndex((item) => item.id === anchorId);
    if (anchorId && anchorIndex < 0) return error(response, 'INVALID_ANCHOR', 'Anchor unavailable');

    const index =
      placement.edge === 'start'
        ? 0
        : placement.edge === 'end'
          ? destinationTasks.length
          : anchorIndex + (placement.afterId ? 1 : 0);
    destinationTasks.splice(index, 0, {
      ...current,
      primaryListId: destinationId,
      statusId,
      customFields: values.values,
    });
    const sourceTasks =
      source.id !== destination.id || current.statusId !== statusId
        ? tasksFor(source, session).filter(
            (item) => item.id !== taskId && item.statusId === current.statusId,
          )
        : [];
    const changed = [];
    for (const group of [sourceTasks, destinationTasks])
      for (const [position, item] of group.entries()) {
        const original =
          overrides.get(item.id) ??
          scopedNodes
            .flatMap((node) => tasksFor(node, session))
            .find((entry) => entry.id === item.id);
        const updated = { ...item, position: position * 10, version: original.version + 1 };
        overrides.set(item.id, updated);
        changed.push(item.id);
      }
    dataVersion++;
    send(
      response,
      200,
      TaskMutationEnvelopeSchema.parse({
        data: overrides.get(taskId),
        configVersion: 1,
        dataVersion,
        changedTaskIds: changed,
      }),
    );
  };
  const respond = async ({ url, session, response, body, method }) => {
    const activity = /^\/v1\/tasks\/([^/]+)\/activity$/.exec(url.pathname);
    if (activity && method === 'GET') {
      await controls.activityGate;
      if (controls.activityError) {
        const failure =
          typeof controls.activityError === 'object'
            ? controls.activityError
            : { code: 'FORBIDDEN', status: 403 };
        if (failure.once) controls.activityError = null;

        error(response, failure.code, 'Activity is unavailable', failure.status);
      } else
        send(
          response,
          200,
          controls.activityPages.get(url.searchParams.get('cursor') ?? '') ??
            ActivityPageSchema.meta().example,
        );

      return true;
    }

    const detail = /^\/v1\/tasks\/([^/]+)$/.exec(url.pathname);
    if (detail && method === 'GET') {
      const task = nodes
        .filter((node) => node.type === 'list' && visible(node, session))
        .flatMap((node) => tasksFor(node, session))
        .find((item) => item.id === detail[1]);
      if (!task) error(response, 'NOT_FOUND', 'Task not found', 404);
      else
        send(
          response,
          200,
          TaskEnvelopeSchema.parse({ data: task, configVersion: 1, dataVersion }),
        );

      return true;
    }

    if (detail && method === 'PATCH') {
      const node = nodes.find(
        (entry) =>
          entry.type === 'list' &&
          visible(entry, session) &&
          tasksFor(entry, session).some((task) => task.id === detail[1]),
      );
      if (!node) error(response, 'NOT_FOUND', 'Task not found', 404);
      else
        await writeTask({
          current: tasksFor(node, session).find((task) => task.id === detail[1]),
          node,
          body,
          session,
          response,
        });

      return true;
    }

    if (detail && method === 'DELETE') {
      const current = nodes
        .filter((node) => node.type === 'list' && visible(node, session))
        .flatMap((node) => tasksFor(node, session))
        .find((task) => task.id === detail[1]);
      const parsed = ArchiveTaskSchema.safeParse(body);
      if (!current) {
        error(response, 'NOT_FOUND', 'Task not found', 404);

        return true;
      }

      if (!parsed.success) {
        error(response, 'VALIDATION_FAILED', 'Invalid archive request');

        return true;
      }

      if (controls.writeGate) await controls.writeGate;

      if (controls.rejectNextWrite) {
        const failure = controls.rejectNextWrite;
        controls.rejectNextWrite = null;
        error(response, failure.code, failure.message, failure.status);

        return true;
      }

      if (
        parsed.data.expectedVersion !== current.version ||
        parsed.data.expectedConfigVersion !== 1
      ) {
        error(response, 'VERSION_CONFLICT', 'Task changed. Reload it before archiving.', 409);

        return true;
      }

      overrides.set(current.id, {
        ...current,
        archivedAt: new Date().toISOString(),
        version: current.version + 1,
      });
      dataVersion++;
      response.writeHead(204).end();

      return true;
    }

    if (/^\/v1\/workspaces\/[^/]+\/members$/.test(url.pathname)) {
      const list = nodes.find((node) => node.id === url.searchParams.get('assignableToListId'));
      if (!visible(list, session)) error(response, 'FORBIDDEN', 'Access denied', 403);
      else
        send(
          response,
          200,
          MemberPageSchema.parse({
            items: [
              {
                ...MemberSchema.meta().example,
                userId: session.data.user.id,
                name: session.data.user.name,
              },
            ],
            configVersion: 1,
            pageInfo: { hasNextPage: false, nextCursor: null },
          }),
        );

      return true;
    }

    const mutation = /^\/v1\/tasks\/([^/]+)\/(move|reorder)$/.exec(url.pathname);
    if (mutation && method === 'POST') {
      await mutate({ taskId: mutation[1], kind: mutation[2], body, session, response });

      return true;
    }

    const match = /^\/v1\/lists\/([^/]+)\/(resolved-statuses|resolved-fields|tasks)$/.exec(
      url.pathname,
    );
    if (!match) return false;

    const [, listId, kind] = match;
    const node = nodes.find(
      (item) => item.id === listId && item.workspaceId === session.data.activeWorkspace.id,
    );
    if (!node || controls.error === 'NOT_FOUND') {
      error(response, 'NOT_FOUND', 'List not found', 404);

      return true;
    }

    if (!visible(node, session) || controls.error === 'FORBIDDEN') {
      error(response, 'FORBIDDEN', 'Access denied', 403);

      return true;
    }

    if (controls.publicGate && node.name === 'Public list') await controls.publicGate;

    if (kind === 'tasks' && method === 'POST') {
      await writeTask({ node, body, session, response });

      return true;
    }

    if (kind === 'resolved-statuses') {
      send(
        response,
        200,
        controls.malformed
          ? { items: [{ name: 'Broken' }], configVersion: 1 }
          : ResolvedStatusCollectionSchema.parse({ items: statusesFor(node), configVersion: 1 }),
      );

      return true;
    }

    if (kind === 'resolved-fields') {
      send(
        response,
        200,
        ResolvedFieldCollectionSchema.parse({ items: fieldsFor(node), configVersion: 1 }),
      );

      return true;
    }

    const statusId = url.searchParams.get('statusId');
    if (controls.tableMode && !statusId) {
      const parsed = ListTasksQuerySchema.safeParse(Object.fromEntries(url.searchParams));
      if (!parsed.success) {
        error(response, 'VALIDATION_FAILED', 'Invalid table query');

        return true;
      }

      const query = parsed.data;
      const owner = JSON.stringify([
        node.id,
        [...url.searchParams].filter(([key]) => key !== 'cursor'),
      ]);
      const cursor = query.cursor ? tableCursors.get(query.cursor) : undefined;
      if (query.cursor && (!cursor || cursor.owner !== owner)) {
        error(response, 'INVALID_CURSOR', 'Table cursor crossed a query');

        return true;
      }

      if (query.cursor && (cursor.version !== dataVersion || controls.staleCursorOnce)) {
        controls.staleCursorOnce = false;
        error(response, 'CURSOR_STALE', 'Table changed', 409);

        return true;
      }

      const rows = controls.empty
        ? []
        : sortedTableRows(tasksFor(node, session), query, statusesFor(node));
      const start = cursor?.offset ?? 0;
      const nextCursor = rows.length > start + 2 ? `table:${++cursorSequence}` : null;
      if (nextCursor)
        tableCursors.set(nextCursor, { owner, offset: start + 2, version: dataVersion });

      const configVersion = controls.driftRounds > 0 ? 2 : 1;
      if (controls.driftRounds > 0) controls.driftRounds--;

      send(
        response,
        200,
        TaskPageSchema.parse({
          items: rows.slice(start, start + 2),
          configVersion,
          dataVersion,
          pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
        }),
      );

      return true;
    }

    if (
      !statusId ||
      url.searchParams.get('sort') !== 'manual' ||
      url.searchParams.get('direction') !== 'asc'
    ) {
      error(response, 'VALIDATION_FAILED', 'Use per-column manual queries');

      return true;
    }

    const cursor = url.searchParams.get('cursor');
    if (cursor && controls.staleCursorOnce) {
      controls.staleCursorOnce = false;
      error(response, 'CURSOR_STALE', 'Board changed', 409);

      return true;
    }

    const allTasks = controls.empty
      ? []
      : tasksFor(node, session).filter((item) => item.statusId === statusId);
    const owner = `${node.id}:${statusId}`;
    if (cursor && issuedCursors.get(cursor) !== owner) {
      error(response, 'INVALID_CURSOR', 'Cursor crossed a column');

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
        dataVersion: dataVersion + (drift ? 1 : 0),
        pageInfo: { hasNextPage: nextCursor !== null, nextCursor },
      }),
    );

    return true;
  };

  return { controls, respond };
}
