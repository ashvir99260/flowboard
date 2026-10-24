import { CalendarDateSchema } from '@flowboard/contracts';

const formatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
});

export function formatCalendarDate(value: string): string | undefined {
  if (!CalendarDateSchema.safeParse(value).success) return undefined;

  return formatter.format(new Date(`${value}T00:00:00Z`));
}

export function formatTimestamp(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Invalid time';

  return new Date(timestamp)
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, ' UTC');
}
