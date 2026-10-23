import { z } from 'zod';

export const CursorSchema = z.string().min(1).max(2048).meta({
  description: 'Opaque server-authenticated continuation token; keep the same query.',
  example: 'opaque.cursor',
  title: 'Cursor',
});

export const PaginationQuerySchema = z
  .strictObject({
    cursor: CursorSchema.optional(),
    limit: z
      .string()
      .regex(/^(?:[1-9]\d?|100)$/)
      .pipe(z.coerce.number<string>().int().min(1).max(100))
      .prefault('50')
      .meta({
        description: 'Maximum returned items, from 1 to 100.',
        example: '50',
        title: 'Page limit',
      }),
  })
  .meta({
    title: 'Pagination query',
    description: 'Forward-only cursor pagination. Offset and unknown keys are rejected.',
    example: { limit: '50' },
  });

export const PageInfoSchema = z
  .strictObject({
    hasNextPage: z.boolean().meta({
      description: 'Whether another page is available.',
      example: false,
      title: 'Has next page',
    }),
    nextCursor: CursorSchema.nullable().meta({
      description: 'Continuation token, or null at the end.',
      example: null,
      title: 'Next cursor',
    }),
  })
  .refine(
    (value) => value.hasNextPage === (value.nextCursor !== null),
    'Continuation flag must agree with cursor',
  )
  .meta({
    title: 'Page information',
    description: 'Consistent forward-pagination state.',
    example: { hasNextPage: false, nextCursor: null },
  });

export function cursorPageSchema<T extends z.ZodType>(item: T) {
  return z
    .strictObject({
      items: z
        .array(item)
        .max(100)
        .meta({ title: 'Items', description: 'Authorized items in stable order.', example: [] }),
      pageInfo: PageInfoSchema,
    })
    .meta({
      title: 'Cursor page',
      description: 'Bounded authorized collection page.',
      example: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
    });
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
