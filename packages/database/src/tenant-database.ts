import { createClient } from './client.js';
import { repositories } from './repositories.js';
import { DatabaseError, tenantRequest } from './tenant-context.js';

import type { Prisma } from './generated/client.js';
import type { ReadRepositories, WriteRepositories } from './repositories.js';
import type { TenantRequest } from './tenant-context.js';

export interface Database {
  close(): Promise<void>;
  read<T>(context: TenantRequest, action: (view: ReadRepositories) => Promise<T>): Promise<T>;
  write<T>(
    context: TenantRequest,
    action: (transaction: WriteRepositories) => Promise<T>,
  ): Promise<T>;
}

export function createDatabase(connectionString: string): Database {
  const client = createClient(connectionString);

  async function run<T>(
    input: TenantRequest,
    write: boolean,
    action: (store: ReturnType<typeof repositories>) => Promise<T>,
  ) {
    const request = tenantRequest(input);
    return client.$transaction(
      async (tx: Prisma.TransactionClient) => {
        if (write) {
          await tx.$queryRaw`SELECT id FROM workspaces WHERE id = ${request.workspaceId}::uuid FOR UPDATE`;
        } else {
          await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        }
        const membership = await tx.membership.findFirst({
          where: { userId: request.actorUserId, workspaceId: request.workspaceId },
        });
        if (!membership)
          throw new DatabaseError('MEMBERSHIP_REQUIRED', 'Workspace membership required');
        let active = true;
        const store = repositories(tx, { ...request, role: membership.role }, () => {
          if (!active) throw new DatabaseError('INTERNAL_ERROR', 'Transaction is closed');
        });
        try {
          return await action(store);
        } finally {
          active = false;
        }
      },
      {
        isolationLevel: write ? 'ReadCommitted' : 'RepeatableRead',
        maxWait: 5000,
        timeout: 10_000,
      },
    );
  }

  return Object.freeze({
    close: () => client.$disconnect(),
    read: <T>(context: TenantRequest, action: (view: ReadRepositories) => Promise<T>) =>
      run(context, false, (store) => action(store.read)),
    write: <T>(context: TenantRequest, action: (transaction: WriteRepositories) => Promise<T>) =>
      run(context, true, (store) => action(store.write)),
  });
}
