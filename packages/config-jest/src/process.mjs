import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

// Real-process smoke tests share lifecycle handling, not application internals.
export function startProcess(args, options) {
  const { outboundOrigins = [], ...spawnOptions } = options;
  const child = spawn(
    process.execPath,
    ['--import', new URL('./no-network.mjs', import.meta.url).href, ...args],
    {
      ...spawnOptions,
      env: {
        ...process.env,
        ...spawnOptions.env,
        FLOWBOARD_TEST_OUTBOUND_ORIGINS: JSON.stringify(outboundOrigins),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const events = new EventEmitter();
  let output = '';
  let result;
  let spawnError;
  const exited = new Promise((resolve) => {
    // `close` follows stdio draining; `exit` can race diagnostic assertions.
    child.once('close', (code, signal) => {
      result = { code, signal };
      events.emit('change');
      resolve(result);
    });
    child.once('error', (error) => {
      spawnError = error;
      events.emit('change');
      resolve({ error });
    });
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      output = (output + chunk.toString()).slice(-32_768);
      events.emit('change');
    });
  }

  return {
    exited,
    output: () => output,
    waitFor(pattern, timeoutMs = 30_000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => finish(new Error(`Startup timed out:\n${output}`)),
          timeoutMs,
        );
        function finish(error, match) {
          clearTimeout(timer);
          events.off('change', check);
          if (error) reject(error);
          else resolve(match);
        }
        function check() {
          const match = output.match(pattern);
          if (match) finish(undefined, match);
          else if (spawnError || result) {
            finish(spawnError ?? new Error(`Process exited before readiness:\n${output}`));
          }
        }
        events.on('change', check);
        check();
      });
    },
    async stop(expectedSignal = null, expectedCode = expectedSignal ? null : 0) {
      if (!result && !spawnError) child.kill('SIGTERM');

      let timer;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(() => {
          child.kill('SIGKILL');
          resolve({ signal: 'SIGKILL' });
        }, 10_000);
      });
      const outcome = await Promise.race([exited, timeout]);
      clearTimeout(timer);
      assert.equal(outcome.signal, expectedSignal, `Expected graceful shutdown:\n${output}`);
      assert.equal(outcome.code, expectedCode, `Unexpected exit code:\n${output}`);
    },
  };
}
