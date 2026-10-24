export interface OutboxSettings {
  batchSize: number;
  leaseMs: number;
  pollMs: number;
  recheckMs: number;
}

export const OutboxDefaults: Readonly<OutboxSettings> = Object.freeze({
  batchSize: 20,
  leaseMs: 30_000,
  pollMs: 500,
  recheckMs: 30_000,
});

export function outboxSettings(overrides: Partial<OutboxSettings> = {}): OutboxSettings {
  const settings = { ...OutboxDefaults, ...overrides };
  const limits = {
    batchSize: [1, 100],
    leaseMs: [1000, 60_000],
    pollMs: [10, 60_000],
    recheckMs: [0, 86_400_000],
  } as const;
  for (const key of Object.keys(limits) as Array<keyof OutboxSettings>) {
    const value = settings[key];
    const [minimum, maximum] = limits[key];
    if (!Number.isInteger(value) || value < minimum || value > maximum)
      throw new Error('Invalid outbox configuration');
  }

  return settings;
}
