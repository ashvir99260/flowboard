import { Socket } from 'node:net';

// Shell tests deny outbound connections; proxy tests can name exact loopback origins.
const allowed = new Set(
  JSON.parse(process.env.FLOWBOARD_TEST_OUTBOUND_ORIGINS ?? '[]').map((value) => {
    const url = new URL(value);
    if (
      url.protocol !== 'http:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      !url.port ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error('Test upstream must be an explicit local HTTP origin');

    return `${url.hostname.replaceAll('[', '').replaceAll(']', '')}:${url.port}`;
  }),
);
const connect = Socket.prototype.connect;
Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options =
    typeof first === 'object' && first !== null ? first : { port: first, host: args[1] };
  const host = options.host ?? options.hostname ?? 'localhost';
  if (allowed.has(`${host}:${options.port}`)) return connect.apply(this, args);

  throw new Error('Unexpected outbound connection from an application shell');
};
