import type { OperationalOutboxRuntime } from '@flowboard/jobs';

type ActivityRuntime = {
  close(): Promise<void>;
  healthy(): Promise<boolean>;
  ready(): Promise<void>;
};

export async function startWorkerRuntime(
  activity: ActivityRuntime,
  outbox: OperationalOutboxRuntime,
) {
  let closing: Promise<void> | undefined;
  const close = () =>
    (closing ??= (async () => {
      const results = await Promise.allSettled([outbox.close(), activity.close()]);
      const failed = results.find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
    })());

  try {
    await activity.ready();
    outbox.start();
    await outbox.ready();
  } catch (error) {
    await close().catch(() => undefined);
    throw error;
  }

  return {
    close,
    healthy: async () => !closing && outbox.healthy() && (await activity.healthy()),
  };
}
