import { z } from 'zod';

export const CalendarDateSchema = z
  .string()
  .regex(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);

    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Must be a real calendar date');

export const TaskDueDateSchema = z.iso
  .datetime({ offset: true })
  .refine(
    (value) =>
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value),
    'Use seconds and at most three fractional digits',
  )
  .refine((value) => {
    const instant = new Date(value);
    const year = instant.getUTCFullYear();

    return Number.isFinite(instant.getTime()) && year >= 1 && year <= 9999;
  }, 'Must be a valid instant within years 0001–9999')
  .overwrite((value) => {
    const instant = new Date(value);

    return Number.isFinite(instant.getTime()) ? instant.toISOString() : value;
  });

export const TimestampSchema = z.iso.datetime({ precision: 3 });

export const AuditTimestampsSchema = z.strictObject({
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
