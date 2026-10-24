import { createClient } from './client.js';

export { initializeDatabase } from './initialize.js';

export { DemoAccounts, DemoPassword, seedDemoData } from './seed.js';

export type { Database } from './tenant-database.js';

export { createDatabase } from './tenant-database.js';

export { DatabaseError } from './tenant-context.js';

export type { TenantContext, TenantRequest } from './tenant-context.js';

export type { ReadRepositories, WriteRepositories } from './repositories.js';

/** Readiness probe without exposing an unrestricted database client. */
export async function verifyDatabaseConnection(connectionString: string): Promise<void> {
  const client = createClient(connectionString, 3000);
  try {
    await client.$queryRaw`SELECT 1`;
  } finally {
    await client.$disconnect();
  }
}

export { createIdentityRepository } from './identity.js';

export type { IdentityRepository } from './identity.js';

export type {
  AuthenticatedIdentity,
  IdentitySession,
  IdentityUser,
  IdentityWorkspace,
  RefreshResult,
  SessionCredential,
  SessionIdentity,
} from './identity.entity.js';

export type {
  MemberProfile,
  MembershipPageQuery,
  MembershipPosition,
} from './membership.entity.js';

export type { NodeSnapshot } from './hierarchy-repository.js';

export { createOutboxRepository } from './outbox-repository.js';

export type { OutboxClaim, OutboxRepository } from './outbox-repository.js';
