export interface SessionSync {
  available: boolean;
  bump(): string;
  exclusive<T>(work: () => Promise<T>): Promise<T>;
  subscribe(listener: () => void): () => void;
  version(): string;
}

export function createLocalSessionSync(available = true): SessionSync {
  let revision = 'initial';
  let tail = Promise.resolve();
  const listeners = new Set<() => void>();

  return {
    available,
    bump() {
      revision = globalThis.crypto.randomUUID();
      queueMicrotask(() => listeners.forEach((listener) => listener()));

      return revision;
    },
    exclusive<T>(work: () => Promise<T>) {
      const result = tail.then(work, work);
      tail = result.then(
        () => undefined,
        () => undefined,
      );

      return result;
    },
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    version: () => revision,
  };
}

export function createSessionSync(): SessionSync {
  if (typeof window === 'undefined') return createLocalSessionSync();

  const key = 'flowboard.session.revision';
  const event = 'flowboard:session-change';
  const browser = window;
  try {
    window.localStorage.getItem(key);
    if (!window.navigator.locks) return createLocalSessionSync(false);
  } catch {
    return createLocalSessionSync(false);
  }

  let available = true;
  let revision = 'initial';
  const notify = () => queueMicrotask(() => browser.dispatchEvent(new Event(event)));
  const failed = () => {
    if (available) {
      available = false;
      revision = globalThis.crypto.randomUUID();
      notify();
    }

    return revision;
  };

  return {
    get available() {
      return available;
    },
    bump() {
      if (!available) return revision;

      try {
        revision = globalThis.crypto.randomUUID();
        browser.localStorage.setItem(key, revision);
        notify();
      } catch {
        return failed();
      }

      return revision;
    },
    exclusive: (work) => browser.navigator.locks.request('flowboard.session', work),
    subscribe(listener) {
      const storage = (notification: StorageEvent) => {
        if (notification.key === key || notification.key === null) listener();
      };
      browser.addEventListener('storage', storage);
      browser.addEventListener(event, listener);

      return () => {
        browser.removeEventListener('storage', storage);
        browser.removeEventListener(event, listener);
      };
    },
    version() {
      if (!available) return revision;

      try {
        return browser.localStorage.getItem(key) ?? 'initial';
      } catch {
        return failed();
      }
    },
  };
}
