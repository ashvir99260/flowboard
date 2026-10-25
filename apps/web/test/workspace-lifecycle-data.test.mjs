import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthExamples } from '@flowboard/contracts';

import {
  archiveStateChanged,
  readWorkspaceWrite,
  WorkspaceDraftSchema,
} from '../src/features/workspaces/workspace-lifecycle.ts';

const { role: _role, ...workspace } = AuthExamples.session.data.activeWorkspace;
const envelope = { data: workspace, configVersion: 2, dataVersion: 2 };
const command = { kind: 'rename', workspaceId: workspace.id, expectedConfigVersion: 1 };

test('workspace write results must match the command, root and allowed revision', () => {
  assert.deepEqual(readWorkspaceWrite(envelope, command), envelope);
  for (const value of [
    { ...envelope, configVersion: 0 },
    { ...envelope, configVersion: 3 },
    { ...envelope, data: { ...workspace, id: '20000000-0000-4000-8000-000000000001' } },
    { ...envelope, data: { ...workspace, archivedAt: '2026-10-25T10:00:00.000Z' } },
    { ...envelope, data: { ...workspace, password: 'untrusted' } },
  ])
    assert.equal(readWorkspaceWrite(value, command), null);
  assert.equal(readWorkspaceWrite(envelope, { ...command, kind: 'archive' }), null);
  assert.deepEqual(readWorkspaceWrite(envelope, { ...command, kind: 'restore' }), envelope);
});

test('only archive-state refresh changes require lifecycle cache reset', () => {
  const session = AuthExamples.session;
  const renamed = structuredClone(session);
  renamed.data.activeWorkspace.name = 'Renamed';
  assert.equal(archiveStateChanged(session, renamed), false);
  const archived = structuredClone(session);
  archived.data.activeWorkspace.archivedAt = '2026-10-25T10:00:00.000Z';
  assert.equal(archiveStateChanged(session, archived), true);
  assert.equal(archiveStateChanged(archived, session), true);
});

test('workspace form uses shared name validation', () => {
  assert.deepEqual(WorkspaceDraftSchema.parse({ name: ' Team ' }), { name: 'Team' });
  assert.equal(WorkspaceDraftSchema.safeParse({ name: '' }).success, false);
  assert.equal(WorkspaceDraftSchema.safeParse({ name: 'x'.repeat(121) }).success, false);
  assert.equal(WorkspaceDraftSchema.safeParse({ name: 'Valid', role: 'admin' }).success, false);
});
