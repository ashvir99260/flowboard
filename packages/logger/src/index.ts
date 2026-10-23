import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

const levels = { debug: 20, error: 50, fatal: 60, info: 30, silent: 70, trace: 10, warn: 40 };
const context = new AsyncLocalStorage<LogContext>();
const identifier = /^[\w.-]{1,100}$/;
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export type LogLevel = keyof typeof levels;

export interface LogContext {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
}

export interface LogFields {
  code?: string;
  component?: string;
  durationMs?: number;
  method?: string;
  operation?: string;
  outcome?: string;
  port?: number;
  route?: string;
  statusCode?: number;
}

type Write = (event: string, fields?: LogFields) => void;

export interface Logger {
  trace: Write;
  debug: Write;
  info: Write;
  warn: Write;
  error: Write;
  fatal: Write;
  observe<T>(operation: string, action: () => Promise<T>): Promise<T>;
}

function safeContext(input: LogContext): LogContext {
  return Object.fromEntries(
    ['requestId', 'userId', 'workspaceId']
      .map((key) => [key, input[key as keyof LogContext]])
      .filter(([, value]) => typeof value === 'string' && uuid.test(value)),
  );
}

export function withLogContext<T>(input: LogContext, action: () => T): T {
  return context.run(safeContext(input), action);
}

export function bindLogContext(action: () => void): () => void {
  const current = context.getStore() ?? {};
  return () => context.run(current, action);
}

export function updateLogContext(input: LogContext): void {
  const current = context.getStore();
  if (current) Object.assign(current, safeContext(input));
}

export function readLogLevel(input: string | undefined): LogLevel {
  if (input === undefined) return 'info';
  if (Object.hasOwn(levels, input)) return input as LogLevel;
  throw new Error('LOG_LEVEL must be trace, debug, info, warn, error, fatal, or silent');
}

function safeFields(fields: LogFields) {
  const strings = ['component', 'operation', 'code', 'method', 'outcome'] as const;
  const numbers = ['statusCode', 'durationMs', 'port'] as const;
  return {
    ...Object.fromEntries(
      strings
        .map((key) => [key, fields[key]])
        .filter(([, value]) => typeof value === 'string' && identifier.test(value)),
    ),
    ...Object.fromEntries(
      numbers
        .map((key) => [key, fields[key]])
        .filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0),
    ),
    ...(typeof fields.route === 'string' && /^[\w/:.-]{1,160}$/.test(fields.route)
      ? { route: fields.route }
      : {}),
  };
}

/** Accept semantic metadata only. Never pass payloads, credentials or exception objects. */
export function createLogger(options: {
  level: LogLevel;
  service: 'api' | 'worker' | 'database';
  write?: (line: string) => void;
}): Logger {
  const sink = options.write ?? ((line: string) => process.stdout.write(line));
  const emit =
    (level: Exclude<LogLevel, 'silent'>): Write =>
    (event, fields = {}) => {
      if (levels[level] < levels[options.level] || !identifier.test(event)) return;
      try {
        sink(
          `${JSON.stringify({
            time: new Date().toISOString(),
            level,
            service: options.service,
            event,
            ...safeContext(context.getStore() ?? {}),
            ...safeFields(fields),
          })}\n`,
        );
      } catch {
        // Logging must not replace the original result or exception when a sink fails.
      }
    };
  const logger = {
    trace: emit('trace'),
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    fatal: emit('fatal'),
    async observe<T>(operation: string, action: () => Promise<T>): Promise<T> {
      const start = performance.now();
      logger.debug('operation.started', { operation });
      try {
        const result = await action();
        logger.debug('operation.completed', { operation, durationMs: performance.now() - start });
        return result;
      } catch (error) {
        logger.debug('operation.failed', { operation, durationMs: performance.now() - start });
        throw error;
      }
    },
  };
  return Object.freeze(logger);
}

export const SilentLogger = createLogger({ level: 'silent', service: 'api' });
