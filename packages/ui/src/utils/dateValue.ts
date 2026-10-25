import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

import type { Dayjs } from 'dayjs';

dayjs.extend(utc);

export type DateInputKind = 'date' | 'datetime-local';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateTimePattern = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const dateTimeFormat = 'YYYY-MM-DDTHH:mm:ss.SSS';

export function parseDateValue(value: string | null, kind: DateInputKind): Dayjs | null {
  if (value === null || value === '') return null;

  const match = kind === 'datetime-local' ? value.match(dateTimePattern) : null;
  const normalized =
    kind === 'date' && datePattern.test(value)
      ? `${value}T00:00:00.000`
      : match
        ? `${match[1]}T${match[2]}:${match[3] ?? '00'}.${(match[4] ?? '').padEnd(3, '0')}`
        : '';
  const parsed = dayjs.utc(`${normalized}Z`);

  return normalized && parsed.isValid() && parsed.format(dateTimeFormat) === normalized
    ? parsed
    : dayjs.utc(Number.NaN);
}

export function serializeDateValue(value: Dayjs | null, kind: DateInputKind): string | null {
  if (value === null) return null;

  // Invalid sections must reach form validation instead of restoring the last valid date.
  return value.utc().format(kind === 'date' ? 'YYYY-MM-DD' : dateTimeFormat);
}
