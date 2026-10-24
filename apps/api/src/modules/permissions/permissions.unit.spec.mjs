import { SilentLogger } from '@flowboard/logger';
import { expect, test } from '@jest/globals';

import { CursorCodec } from '../../../dist/core/common/cursor.js';
import { PermissionService } from '../../../dist/modules/permissions/permission.service.js';

test('tree continuation rejects a data-only revision change even when configuration is unchanged', async () => {
  const id = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const workspace = { id: id(1), name: 'Fixture', configVersion: 1, dataVersion: 1 };
  const nodes = [2, 3].map((n) => ({
    id: id(n),
    workspaceId: workspace.id,
    type: 'space',
    name: 'Fixture space',
    position: n,
    parentId: null,
    visibility: 'public',
    version: 1,
    archivedAt: null,
    createdAt: new Date('2026-10-24T00:00:00Z'),
    updatedAt: new Date('2026-10-24T00:00:00Z'),
  }));
  // Unit-only snapshot fixture; API permission and persistence tests use real PostgreSQL.
  const database = {
    read: async (_context, action) =>
      action({
        context: { workspaceId: workspace.id, actorUserId: id(4), role: 'admin' },
        access: { snapshot: async () => ({ nodes, grants: [], workspace }) },
      }),
  };
  const service = new PermissionService(
    { database, cursor: new CursorCodec(new Uint8Array(32)) },
    SilentLogger,
  );
  const identity = { activeWorkspace: workspace, user: { id: id(4) } };
  const first = await service.listTree(identity, { limit: 1 });
  expect(first.pageInfo.hasNextPage).toBe(true);
  workspace.dataVersion += 1;
  await expect(
    service.listTree(identity, { limit: 1, cursor: first.pageInfo.nextCursor }),
  ).rejects.toMatchObject({ code: 'CURSOR_STALE', status: 409 });
});
