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
