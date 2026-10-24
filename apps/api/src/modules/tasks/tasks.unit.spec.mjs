import { TaskSchema } from '@flowboard/contracts';
import { SilentLogger } from '@flowboard/logger';
import { expect, jest, test } from '@jest/globals';

import { CursorCodec } from '../../../dist/core/common/cursor.js';
import { TasksService } from '../../../dist/modules/tasks/tasks.service.js';

const id = '10000000-0000-4000-8000-000000000001';

test.each(['configVersion', 'dataVersion'])(
  'a changed %s rejects a cursor before loading a mismatched page',
  async (revision) => {
    const versions = { configVersion: 1, dataVersion: 1 };
    const data = TaskSchema.parse(TaskSchema.meta().example);
    const list = jest.fn(async () => [data, { ...data, id }]);
    const database = {
      read: async (_context, action) =>
        action({ tasks: { revisions: async () => ({ ...versions }), list } }),
    };
    const permissions = { assertNode: jest.fn(async () => undefined) };
    const service = new TasksService(
      { database, cursor: new CursorCodec(new Uint8Array(32)) },
      permissions,
      SilentLogger,
    );
    const identity = { user: { id }, activeWorkspace: { id } };
    const query = { direction: 'asc', limit: 1, sort: 'manual' };
    const page = await service.list(identity, id, query);
    expect(page.pageInfo.hasNextPage).toBe(true);
    versions[revision] += 1;
    await expect(
      service.list(identity, id, { ...query, cursor: page.pageInfo.nextCursor }),
    ).rejects.toMatchObject({ code: 'CURSOR_STALE' });
    expect(list).toHaveBeenCalledTimes(1);
  },
);
