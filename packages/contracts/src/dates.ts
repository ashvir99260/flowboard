import { z } from 'zod';

export const CalendarDateSchema = z
  .string()
  .regex(/^(?!0000)\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'Must be a real calendar date');

export const TimestampSchema = z.iso.datetime({ precision: 3 });

export const AuditTimestampsSchema = z.strictObject({
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
