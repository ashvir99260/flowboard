import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.ts';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.ts';
import { PermissionService } from '../permissions/permission.service.ts';

import type { CursorCodec } from '../../core/common/cursor.ts';
import type { ActivityPage, ActivityQuery } from '@flowboard/contracts';
import type { Database, IdentitySession } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export const ActivityRuntimeKey = 'flowboard:activity-runtime';

export interface ActivityRuntime {
  cursor?: CursorCodec;
  database?: Database;
}

@Injectable()
export class ActivityService {
  constructor(
    @Inject(ActivityRuntimeKey) private readonly runtime: ActivityRuntime,
    private readonly permissions: PermissionService,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}
  async list(
    identity: IdentitySession,
    taskId: string,
    query: ActivityQuery,
  ): Promise<ActivityPage> {
    const { database, cursor } = this.runtime;
    if (!database || !cursor)
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Activity unavailable');

    if (!identity.activeWorkspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    const context = { actorUserId: identity.user.id, workspaceId: identity.activeWorkspace.id };
    const binding = {
      caller: context.actorUserId,
      workspaceId: context.workspaceId,
      resource: `activity:${taskId}`,
      limit: query.limit,
    };
    const previous = cursor.decodeActivity(query.cursor, binding);

    return this.logger.observe('activity.list', () =>
      database.read(context, async (store) => {
        await this.permissions.assertTask(store, taskId, 'activity.read');
        const page = await store.activities.list(taskId, {
          limit: query.limit,
          ...(previous
            ? {
                after: { createdAt: new Date(previous.after.createdAt), id: previous.after.id },
                upper: { createdAt: new Date(previous.upper.createdAt), id: previous.upper.id },
              }
            : {}),
        });
        const items = page.items.slice(0, query.limit);
        const last = items.at(-1);
        const nextCursor =
          page.items.length > query.limit && last && page.upper
            ? cursor.encodeActivity(
                binding,
                { createdAt: new Date(last.createdAt), id: last.id },
                page.upper,
                previous,
              )
            : null;

        return { items, pageInfo: { hasNextPage: nextCursor !== null, nextCursor } };
      }),
    );
  }
}
