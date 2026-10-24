import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import net from 'node:net';
import tls from 'node:tls';

function rejectNetwork() {
  appendFileSync(process.env.FLOWBOARD_NETWORK_ATTEMPTS, 'attempt\n');
  throw new Error('Spec export attempted network access');
}

net.Socket.prototype.connect = rejectNetwork;
net.Server.prototype.listen = rejectNetwork;
tls.connect = rejectNetwork;
globalThis.fetch = rejectNetwork;
syncBuiltinESMExports();
