import { startInfrastructure } from '@flowboard/config-jest/infrastructure';
import { initializeDatabase } from '@flowboard/database';

export async function workerInfrastructure() {
  const infrastructure = await startInfrastructure();
  try {
    await initializeDatabase({ databaseUrl: infrastructure.databaseUrl });
    const outboundOrigins = [infrastructure.databaseUrl, infrastructure.redisUrl].flatMap((url) =>
      ['localhost', '127.0.0.1', '[::1]'].map((host) => `http://${host}:${new URL(url).port}`),
    );

    return {
      ...infrastructure,
      outboundOrigins,
      env: { DATABASE_URL: infrastructure.databaseUrl, REDIS_URL: infrastructure.redisUrl },
    };
  } catch (error) {
    infrastructure.close();
    throw error;
  }
}
