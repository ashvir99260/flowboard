import { Socket } from 'node:net';

// Smoke-test child processes may accept requests but must not initiate connections.
Socket.prototype.connect = function () {
  throw new Error('Unexpected outbound connection from an application shell');
};
