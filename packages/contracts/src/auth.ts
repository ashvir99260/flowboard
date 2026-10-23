import { z } from 'zod';

import { TimestampSchema } from './dates.js';
import { WorkspaceRoleSchema } from './enums.js';
import { EmailSchema, NameSchema, PasswordSchema, UuidSchema } from './identifiers.js';

export const SignUpSchema = z.strictObject({
  email: EmailSchema,
  name: NameSchema,
  password: PasswordSchema.meta({ format: 'password', writeOnly: true }),
  workspaceName: NameSchema,
});
export const LogInSchema = z.strictObject({
  email: EmailSchema,
  password: PasswordSchema.meta({ format: 'password', writeOnly: true }),
});
export const UserSelfSchema = z.strictObject({
  createdAt: TimestampSchema,
  email: EmailSchema,
  id: UuidSchema,
  name: NameSchema,
  updatedAt: TimestampSchema,
});
export const ActiveWorkspaceSchema = z.strictObject({
  createdAt: TimestampSchema,
  id: UuidSchema,
  name: NameSchema,
  role: WorkspaceRoleSchema,
  updatedAt: TimestampSchema,
});
export const SessionEnvelopeSchema = z.strictObject({
  data: z.strictObject({
    accessToken: z.string().min(1),
    activeWorkspace: ActiveWorkspaceSchema.nullable(),
    expiresAt: TimestampSchema,
    user: UserSelfSchema,
  }),
});
export type SignUp = z.infer<typeof SignUpSchema>;
export type LogIn = z.infer<typeof LogInSchema>;
export type SessionEnvelope = z.infer<typeof SessionEnvelopeSchema>;

export const EmptyAuthBodySchema = z.strictObject({}).default({});
