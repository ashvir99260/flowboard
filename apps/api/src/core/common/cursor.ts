import { createHmac, timingSafeEqual } from 'node:crypto';

import { TimestampSchema, UuidSchema } from '@flowboard/contracts';
import { z } from 'zod';

import { ApiException } from './errors/api-exception.js';

const payloadSchema = z.strictObject({
  v: z.literal(1),
  caller: UuidSchema,
  workspaceId: UuidSchema.nullable(),
  resource: z.string().max(100),
  limit: z.number().int().min(1).max(100),
  expiresAt: z.number().int().positive(),
  after: z.strictObject({ createdAt: TimestampSchema, id: UuidSchema }),
  configVersion: z.number().int().positive().optional(),
});

export type CursorBinding = Pick<
  z.infer<typeof payloadSchema>,
  'caller' | 'workspaceId' | 'resource' | 'limit'
>;

export class CursorCodec {
  constructor(private readonly secret: Uint8Array) {}
  private signature(value: string) {
    return createHmac('sha256', this.secret).update(`flowboard:cursor:v1:${value}`).digest();
  }
  decode(value: string | undefined, binding: CursorBinding) {
    if (value === undefined) return undefined;

    try {
      if (value.length > 2048 || !/^[\w-]+\.[\w-]+$/.test(value))
        throw new Error('Invalid encoding');

      const [encoded, signature] = value.split('.') as [string, string];
      const supplied = Buffer.from(signature, 'base64url');
      const expected = this.signature(encoded);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
        throw new Error('Invalid signature');

      const payload = payloadSchema.parse(
        JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')),
      );
      if (
        payload.expiresAt <= Date.now() ||
        Object.entries(binding).some(
          ([key, expectedValue]) => payload[key as keyof CursorBinding] !== expectedValue,
        )
      )
        throw new Error('Invalid binding');

      return payload;
    } catch {
      throw new ApiException(400, 'INVALID_CURSOR', 'Invalid or expired cursor', [
        {
          code: 'invalid_cursor',
          message: 'Restart pagination with the same query',
          path: ['cursor'],
        },
      ]);
    }
  }
  encode(
    binding: CursorBinding,
    after: { createdAt: Date; id: string },
    previous?: ReturnType<CursorCodec['decode']>,
    configVersion?: number,
  ) {
    const payload = payloadSchema.parse({
      ...binding,
      v: 1,
      after: { createdAt: after.createdAt.toISOString(), id: after.id },
      expiresAt: previous?.expiresAt ?? Date.now() + 900_000,
      ...(configVersion === undefined ? {} : { configVersion }),
    });
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');

    return `${encoded}.${this.signature(encoded).toString('base64url')}`;
  }
}
