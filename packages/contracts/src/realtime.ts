import { z } from 'zod';

import { UuidSchema } from './identifiers.js';

export const SocketEvents = {
  invalidate: 'invalidate',
  subscribe: 'list.subscribe',
  unsubscribe: 'list.unsubscribe',
} as const;

export const ListSubscriptionSchema = z.strictObject({
  listId: UuidSchema.transform((id) => id.toLowerCase()),
});

// Public messages deliberately contain no task identity, body, or move destination.
export const RealtimeInvalidationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('list'), listId: UuidSchema, eventId: UuidSchema }),
  z.strictObject({ kind: z.literal('workspace'), eventId: UuidSchema }),
  z.strictObject({ kind: z.literal('resync') }),
]);

export type RealtimeInvalidation = z.infer<typeof RealtimeInvalidationSchema>;
