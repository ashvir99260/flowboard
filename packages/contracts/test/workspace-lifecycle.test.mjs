import { expect, test } from '@jest/globals';

import {
  ActiveWorkspaceSchema,
  AuthExamples,
  ExpectedConfigSchema,
  UpdateWorkspaceSchema,
  WorkspaceEnvelopeSchema,
} from '../dist/index.js';

test('workspace mutation contracts reject ownership, timestamps and invalid revision/name', () => {
  expect(
    UpdateWorkspaceSchema.parse({ expectedConfigVersion: 1, name: ' Engineering ' }).name,
  ).toBe('Engineering');
  for (const value of [
    { expectedConfigVersion: 1, name: '' },
    { name: 'x'.repeat(121), expectedConfigVersion: 1 },
    { expectedConfigVersion: 0, name: 'Valid' },
    { name: 'Valid' },
    { expectedConfigVersion: 1, name: 'Valid', role: 'admin' },
    { archivedAt: null, expectedConfigVersion: 1, name: 'Valid' },
  ])
    expect(UpdateWorkspaceSchema.safeParse(value).success).toBe(false);
  expect(
    ExpectedConfigSchema.safeParse({ expectedConfigVersion: 1, workspaceId: 'spoofed' }).success,
  ).toBe(false);
});

test('archive state is required safe response metadata with server-owned timestamps', () => {
  const active = AuthExamples.session.data.activeWorkspace;
  expect(ActiveWorkspaceSchema.parse(active).archivedAt).toBeNull();
  expect(ActiveWorkspaceSchema.safeParse({ ...active, archivedAt: 'tomorrow' }).success).toBe(
    false,
  );
  const { role: _role, ...data } = active;
  expect(WorkspaceEnvelopeSchema.parse({ data, configVersion: 2, dataVersion: 3 }).data.id).toBe(
    active.id,
  );
  expect(
    WorkspaceEnvelopeSchema.safeParse({
      data: { ...data, passwordHash: 'secret' },
      configVersion: 2,
      dataVersion: 3,
    }).success,
  ).toBe(false);
});
