import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/client.js';

// Internal only. Package exports expose repositories, never this client.
export function createClient(connectionString: string): PrismaClient {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('A PostgreSQL connection URL is required');
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: 10 }) });
}
