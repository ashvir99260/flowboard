import { BulkUpdateTasksSchema } from '@flowboard/contracts';
import { DatabaseError } from '@flowboard/database';
import { Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../../core/common/errors/api-exception.ts';
import { ApiLoggerKey } from '../../core/common/tokens/logger.token.ts';
import { PermissionService } from '../permissions/permission.service.ts';

import { TasksRuntimeKey } from './tasks.service.ts';

import type { TasksRuntime } from './tasks.service.ts';
import type { BulkTaskMutationEnvelope, BulkUpdateTasks, Task } from '@flowboard/contracts';
import type { IdentitySession } from '@flowboard/database';
import type { Logger } from '@flowboard/logger';

@Injectable()
export class BulkTasksService {
  constructor(
    @Inject(TasksRuntimeKey) private readonly runtime: TasksRuntime,
    private readonly permissions: PermissionService,
    @Inject(ApiLoggerKey) private readonly logger: Logger,
  ) {}

  async update(
    identity: IdentitySession,
    input: BulkUpdateTasks,
  ): Promise<BulkTaskMutationEnvelope> {
    const { database } = this.runtime;
    if (!database) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Task writes unavailable');

    const workspace = identity.activeWorkspace;
    if (!workspace)
      throw new ApiException(403, 'MEMBERSHIP_REQUIRED', 'Workspace membership required');

    const command = BulkUpdateTasksSchema.parse(input);

    return this.logger.observe('tasks.bulk.update', () =>
      database.write(
        { actorUserId: identity.user.id, workspaceId: workspace.id },
        async (store) => {
          for (const target of command.tasks)
            await this.permissions.assertTask(store, target.id, 'task.write');

          const data: Task[] = [];
          const changedTaskIds = new Set<string>();
          for (const [index, target] of command.tasks.entries()) {
            try {
              const result = await store.tasks.update(target.id, {
                ...command.patch,
                expectedConfigVersion: command.expectedConfigVersion,
                expectedVersion: target.expectedVersion,
              });
              data.push(result.data);
              for (const id of result.changedTaskIds) changedTaskIds.add(id);
            } catch (error) {
              if (error instanceof DatabaseError && error.details)
                throw new DatabaseError(error.code, error.message, [
                  {
                    code: 'invalid_target',
                    path: ['tasks', index],
                    message: 'This target cannot accept the shared patch',
                  },
                  ...error.details.map((issue) => ({ ...issue, path: ['patch', ...issue.path] })),
                ]);

              throw error;
            }
          }

          return { data, ...(await store.tasks.revisions()), changedTaskIds: [...changedTaskIds] };
        },
      ),
    );
  }
}
