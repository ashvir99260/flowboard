import assert from 'node:assert/strict';
import test from 'node:test';

import { MemberSchema, NodeExamples, NodeSchema } from '@flowboard/contracts';

import {
  administrationCommand,
  administrationDefaults,
  administrationDraftSchema,
} from '../src/features/administration/administrationCommands.ts';
import {
  containerLabel,
  readAdministration,
  readContainerWrite,
  readGrantWrite,
} from '../src/features/administration/administrationData.ts';

const workspaceId = NodeExamples.node.workspaceId;
const space = NodeSchema.parse(NodeExamples.node);
const folder = NodeSchema.parse({
  ...space,
  id: '10000000-0000-4000-8000-000000000011',
  type: 'folder',
  name: 'Delivery',
  parentId: space.id,
});
const member = MemberSchema.parse(MemberSchema.meta().example);
const page = (items, extra = {}) => ({
  items,
  configVersion: 1,
  pageInfo: { hasNextPage: false, nextCursor: null },
  ...extra,
});
const tree = page([space, folder], {
  dataVersion: 1,
  root: { id: workspaceId, name: 'Workspace', type: 'workspace' },
});
const grant = {
  resourceId: folder.id,
  userId: member.userId,
  mode: 'allow',
  createdAt: member.createdAt,
  updatedAt: member.updatedAt,
};
const input = () => ({
  workspaceId,
  nodeId: folder.id,
  treePages: [tree],
  memberPages: [page([member])],
  grantPages: [page([grant])],
});
const snapshot = () => readAdministration(input()).snapshot;

test('administration waits for complete cursor snapshots and rejects mixed revisions or hostile rows', () => {
  assert.equal(readAdministration(input()).state, 'ready');
  assert.equal(
    readAdministration({
      ...input(),
      grantPages: [page([], { pageInfo: { hasNextPage: true, nextCursor: 'next' } })],
    }).state,
    'pending',
  );
  assert.equal(
    readAdministration({ ...input(), memberPages: [page([member], { configVersion: 2 })] }).state,
    'stale',
  );
  assert.equal(
    readAdministration({ ...input(), grantPages: [page([{ ...grant, resourceId: space.id }])] })
      .state,
    'invalid',
  );
  assert.equal(
    readAdministration({ ...input(), memberPages: [page([member, member])] }).state,
    'invalid',
  );
  assert.equal(
    readAdministration({ ...input(), grantPages: [page([grant, grant])] }).state,
    'invalid',
  );
  assert.equal(
    readAdministration({
      ...input(),
      treePages: [
        { ...tree, items: [{ ...space, workspaceId: '10000000-0000-4000-8000-000000000099' }] },
      ],
    }).state,
    'invalid',
  );
  assert.equal(
    readAdministration({
      ...input(),
      grantPages: [
        page([], { pageInfo: { hasNextPage: true, nextCursor: 'same' } }),
        page([], { pageInfo: { hasNextPage: true, nextCursor: 'same' } }),
      ],
    }).state,
    'invalid',
  );
});

test('container forms validate hierarchy and produce minimal changes or a no-op', () => {
  const data = snapshot();
  const create = { kind: 'create' };
  const defaults = administrationDefaults(create, data);
  assert.equal(
    administrationDraftSchema(create, data).safeParse({
      ...defaults,
      name: 'New',
      type: 'list',
      parentId: space.id,
    }).success,
    false,
  );
  const valid = { ...defaults, name: 'New folder', type: 'folder', parentId: space.id };
  assert.equal(administrationDraftSchema(create, data).safeParse(valid).success, true);
  assert.equal(administrationCommand(create, data, valid).body.parentId, space.id);
  const edit = { kind: 'details', nodeId: folder.id };
  const draft = administrationDefaults(edit, data);
  assert.equal(administrationCommand(edit, data, draft), null);
  assert.deepEqual(administrationCommand(edit, data, { ...draft, name: 'Updated' }), {
    kind: 'update',
    nodeId: folder.id,
    body: { expectedConfigVersion: 1, expectedVersion: 1, name: 'Updated' },
  });
  assert.equal(containerLabel(folder, data.nodes), 'folder: Engineering / Delivery');
});

test('grant edits distinguish allow, deny and explicit removal without changing identity', () => {
  const data = snapshot();
  const selection = { kind: 'grant', nodeId: folder.id, userId: member.userId };
  const draft = administrationDefaults(selection, data);
  assert.equal(administrationCommand(selection, data, draft), null);
  assert.deepEqual(administrationCommand(selection, data, { ...draft, grantMode: 'none' }), {
    kind: 'removeGrant',
    nodeId: folder.id,
    userId: member.userId,
    body: { expectedConfigVersion: 1 },
  });
  const deny = administrationCommand(selection, data, { ...draft, grantMode: 'deny' });
  assert.equal(deny.body.mode, 'deny');
  assert.equal(deny.body.userId, member.userId);
});

test('write response checks reject substituted containers and grant identities', () => {
  const envelope = { data: folder, configVersion: 2, dataVersion: 2 };
  assert.ok(readContainerWrite(envelope, { workspaceId, nodeId: folder.id }));
  assert.equal(readContainerWrite(envelope, { workspaceId, nodeId: space.id }), null);
  assert.ok(
    readGrantWrite(
      { data: grant, configVersion: 2 },
      { configVersion: 1, nodeId: folder.id, userId: member.userId, mode: 'allow' },
    ),
  );
  assert.equal(
    readGrantWrite(
      { data: grant, configVersion: 2 },
      { configVersion: 1, nodeId: folder.id, userId: member.userId, mode: 'deny' },
    ),
    null,
  );
});
