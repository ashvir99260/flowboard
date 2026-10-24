import { ExpressAdapter } from '@nestjs/platform-express';

import type { Server } from 'node:http';

export class GracefulExpressAdapter extends ExpressAdapter {
  override async close(): Promise<void> {
    const server: Server = this.getHttpServer();
    const timeout = setTimeout(() => server.closeAllConnections(), 5000);
    timeout.unref();
    try {
      await super.close();
    } finally {
      clearTimeout(timeout);
    }
  }
}
