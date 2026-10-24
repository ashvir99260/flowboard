import type { Redis } from 'ioredis';

/** Adapter commands are fire-and-forget; observe failures without changing their return values. */
export function observedAdapterClient(client: Redis, failed: () => void): Redis {
  return new Proxy(client, {
    get(target, key) {
      const member: unknown = Reflect.get(target, key, target);
      if (typeof member !== 'function') return member;

      return (...args: unknown[]) => {
        const result: unknown = Reflect.apply(member, target, args);
        if (result instanceof Promise) void result.catch(failed);

        return result;
      };
    },
  });
}
