import { z } from 'zod';

export const CursorSchema = z.string().min(1).max(2048);

export const PaginationQuerySchema = z.strictObject({
  cursor: CursorSchema.optional(),
  limit: z
    .string()
    .regex(/^(?:[1-9]\d?|100)$/)
    .pipe(z.coerce.number<string>().int().min(1).max(100))
    .prefault('50'),
});

export const PageInfoSchema = z
  .strictObject({ hasNextPage: z.boolean(), nextCursor: CursorSchema.nullable() })
  .refine(
    (value) => value.hasNextPage === (value.nextCursor !== null),
    'Continuation flag must agree with cursor',
  );

export function cursorPageSchema<T extends z.ZodType>(item: T) {
  return z.strictObject({ items: z.array(item).max(100), pageInfo: PageInfoSchema });
}

export function parseQueryEntries(entries: Iterable<readonly [string, string]>) {
  const query: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (Object.hasOwn(query, key)) {
      throw new z.ZodError([{ code: 'custom', message: 'Duplicate query parameter', path: [key] }]);
    }

    Object.defineProperty(query, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true,
    });
  }

  return PaginationQuerySchema.parse(query);
}
