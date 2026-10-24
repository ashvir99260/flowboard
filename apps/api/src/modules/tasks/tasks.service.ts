import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.js';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.js';
import { PermissionService } from '../permissions/permission.service.js';

import type { CursorCodec } from '../../core/common/cursor.js';
import type {
  ArchiveTask,
  CreateTask,
  ListTasksQuery,
  Task,
  TaskPosition,
  UpdateTask,
} from '@flowboard/contracts';
import type { Database, IdentitySession, WriteRepositories } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

export const TasksRuntimeKey = 'flowboard:tasks-runtime';

export interface TasksRuntime {
  cursor?: CursorCodec;
  database?: Database;
}

@Injectable()
export class TasksService {
  constructor(
    @Inject(TasksRuntimeKey) private readonly runtime: TasksRuntime,
    private readonly permissions: PermissionService,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}
  private resources(identity: IdentitySession) {
    if (!this.runtime.database || !this.runtime.cursor)
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Task reads unavailable');

    if (!identity.activeWorkspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    return {
      database: this.runtime.database,
      cursor: this.runtime.cursor,
      context: { actorUserId: identity.user.id, workspaceId: identity.activeWorkspace.id },
    };
  }
  private write<T>(
    identity: IdentitySession,
    target: { listId: string } | { taskId: string },
    action: (store: WriteRepositories) => Promise<T>,
  ) {
    const { database, context } = this.resources(identity);

    return this.logger.observe('tasks.write', () =>
      database.write(context, async (store) => {
        if ('listId' in target) {
          await store.scopes.path({ ownerType: 'list', ownerId: target.listId });
          await this.permissions.assertNode(store, target.listId, 'task.write');
        } else await this.permissions.assertTask(store, target.taskId, 'task.write');

        return action(store);
      }),
    );
  }
  create(identity: IdentitySession, listId: string, input: CreateTask) {
    return this.write(identity, { listId }, (store) => store.tasks.create(listId, input));
  }
  update(identity: IdentitySession, taskId: string, input: UpdateTask) {
    return this.write(identity, { taskId }, (store) => store.tasks.update(taskId, input));
  }
  archive(identity: IdentitySession, taskId: string, input: ArchiveTask) {
    return this.write(identity, { taskId }, (store) => store.tasks.archive(taskId, input));
  }
  detail(identity: IdentitySession, taskId: string) {
    const { database, context } = this.resources(identity);

    return this.logger.observe('tasks.read', () =>
      database.read(context, async (store) => {
        const data = await this.permissions.assertTask(store, taskId, 'task.read');

        return { data, ...(await store.tasks.revisions()) };
      }),
    );
  }
  list(identity: IdentitySession, listId: string, query: ListTasksQuery) {
    const { database, cursor, context } = this.resources(identity);
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          sort: query.sort,
          direction: query.direction,
          statusId: query.statusId,
          assigneeId: query.assigneeId,
          priority: query.priority,
          fieldKey: query.fieldKey,
          fieldOperator: query.fieldOperator,
          fieldValue: query.fieldValue,
        }),
      )
      .digest('hex');
    const binding = {
      caller: context.actorUserId,
      workspaceId: context.workspaceId,
      resource: `tasks:${listId}`,
      limit: query.limit,
      fingerprint,
    };

    return this.logger.observe('tasks.list', () =>
      database.read(context, async (store) => {
        await this.permissions.assertNode(store, listId, 'task.read');
        const previous = cursor.decodeTask(query.cursor, binding);
        const revisions = await store.tasks.revisions();
        if (
          previous &&
          (previous.configVersion !== revisions.configVersion ||
            previous.dataVersion !== revisions.dataVersion)
        )
          throw new ApiException(409, 'CURSOR_STALE', 'Tasks changed; restart pagination');

        const rows = await store.tasks.list(listId, query, previous?.after);
        const items = rows.slice(0, query.limit);
        const last = items.at(-1);
        const position = (task: Task): TaskPosition => {
          if (query.sort === 'manual')
            return {
              sort: 'manual',
              id: task.id,
              statusId: task.statusId,
              position: task.position,
            };

          if (query.sort === 'dueDate')
            return { sort: 'dueDate', id: task.id, dueDate: task.dueDate };

          return { sort: 'priority', id: task.id, priority: task.priority };
        };
        const hasNextPage = rows.length > query.limit;

        return {
          items,
          ...revisions,
          pageInfo: {
            hasNextPage,
            nextCursor:
              hasNextPage && last
                ? cursor.encodeTask(binding, position(last), revisions, previous)
                : null,
          },
        };
      }),
    );
  }
}
