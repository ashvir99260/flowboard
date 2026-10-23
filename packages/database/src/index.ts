import { createClient } from './client.js';

/** Readiness probe without exposing an unrestricted database client. */
export async function verifyDatabaseConnection(connectionString: string): Promise<void> {
  const client = createClient(connectionString);
  try {
    await client.$queryRaw`SELECT 1`;
  } finally {
    await client.$disconnect();
  }
}
