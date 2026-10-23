import { z } from 'zod';

import { TimestampSchema } from './dates.js';
import { WorkspaceRoleSchema } from './enums.js';
import { EmailSchema, NameSchema, PasswordSchema, UuidSchema } from './identifiers.js';

// Documentation-only values. These tokens/passwords are not issued demo credentials.
export const AuthExamples = {
  logIn: { email: 'alex@example.test', password: 'Example-only-passphrase-42!' },
  signUp: {
    email: 'alex@example.test',
    name: 'Alex Rivera',
    password: 'Example-only-passphrase-42!',
    workspaceName: 'Alex workspace',
  },
  session: {
    data: {
      accessToken: 'example-only.access-token.not-valid',
      activeWorkspace: {
        createdAt: '2026-10-23T10:00:00.000Z',
        id: '10000000-0000-4000-8000-000000000002',
        name: 'Alex workspace',
        role: 'admin',
        updatedAt: '2026-10-23T10:00:00.000Z',
      },
      expiresAt: '2026-10-23T10:15:00.000Z',
      user: {
        createdAt: '2026-10-23T10:00:00.000Z',
        email: 'alex@example.test',
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Alex Rivera',
        updatedAt: '2026-10-23T10:00:00.000Z',
      },
    },
  },
};

const email = EmailSchema.meta({
  title: 'Email address',
  description: 'Account email, trimmed and normalized to lowercase.',
  example: AuthExamples.logIn.email,
});
const password = PasswordSchema.meta({
  title: 'Password',
  description:
    '12–128 Unicode characters. Whitespace is significant. The example is not a configured account password.',
  example: AuthExamples.logIn.password,
  format: 'password',
  writeOnly: true,
});
const createdAt = TimestampSchema.meta({
  description: 'Server-owned creation timestamp in UTC with millisecond precision.',
  example: '2026-10-23T10:00:00.000Z',
  title: 'Created at',
});
const updatedAt = TimestampSchema.meta({
  description: 'Server-owned last modification timestamp in UTC with millisecond precision.',
  example: '2026-10-23T10:00:00.000Z',
  title: 'Updated at',
});

export const SignUpSchema = z
  .strictObject({
    email,
    name: NameSchema.meta({
      title: 'Display name',
      description: 'User display name, trimmed and limited to 120 Unicode characters.',
      example: AuthExamples.signUp.name,
    }),
    password,
    workspaceName: NameSchema.meta({
      title: 'Workspace name',
      description: 'Name of the new workspace. The account becomes its administrator.',
      example: AuthExamples.signUp.workspaceName,
    }),
  })
  .meta({
    title: 'Sign up request',
    description:
      'Create an account and its first workspace. Acting role and workspace identifiers cannot be supplied.',
    example: AuthExamples.signUp,
  });

export const LogInSchema = z.strictObject({ email, password }).meta({
  title: 'Log in request',
  description:
    'Authenticate an existing account with email and password. Example credentials are illustrative only.',
  example: AuthExamples.logIn,
});

export const UserSelfSchema = z
  .strictObject({
    createdAt,
    email,
    id: UuidSchema.meta({
      title: 'User ID',
      description: 'Stable server-generated account identifier.',
      example: AuthExamples.session.data.user.id,
    }),
    name: NameSchema.meta({
      title: 'Display name',
      description: 'The authenticated user’s display name.',
      example: AuthExamples.session.data.user.name,
    }),
    updatedAt,
  })
  .meta({
    title: 'Authenticated user',
    description:
      'Safe account projection. Password hashes and refresh credentials are never included.',
    example: AuthExamples.session.data.user,
  });

export const ActiveWorkspaceSchema = z
  .strictObject({
    createdAt,
    id: UuidSchema.meta({
      title: 'Workspace ID',
      description: 'Identifier of the workspace selected for this login family.',
      example: AuthExamples.session.data.activeWorkspace.id,
    }),
    name: NameSchema.meta({
      title: 'Workspace name',
      description: 'Display name of the selected workspace.',
      example: AuthExamples.session.data.activeWorkspace.name,
    }),
    role: WorkspaceRoleSchema.meta({
      description:
        'Current membership role read from the database; it is not a global account role.',
      example: 'admin',
      title: 'Workspace role',
    }),
    updatedAt,
  })
  .meta({
    title: 'Active workspace',
    description: 'Selected workspace and the user’s current membership role.',
    example: AuthExamples.session.data.activeWorkspace,
  });

export const SessionEnvelopeSchema = z
  .strictObject({
    data: z
      .strictObject({
        accessToken: z.string().min(1).meta({
          title: 'Access token',
          description:
            'Short-lived bearer JWT. Keep it in memory. This documentation token is deliberately nonfunctional.',
          example: AuthExamples.session.data.accessToken,
        }),
        activeWorkspace: ActiveWorkspaceSchema.nullable().meta({
          title: 'Active workspace',
          description:
            'Selected workspace, or null when the account has no memberships. Member routes require a workspace.',
          example: AuthExamples.session.data.activeWorkspace,
        }),
        expiresAt: TimestampSchema.meta({
          title: 'Access expiry',
          description:
            'UTC access-token expiry, at most 15 minutes away and never beyond the refresh family’s fixed lifetime.',
          example: AuthExamples.session.data.expiresAt,
        }),
        user: UserSelfSchema,
      })
      .meta({
        title: 'Session data',
        description:
          'Access token, safe user details and current workspace. The refresh credential is returned only as a cookie.',
        example: AuthExamples.session.data,
      }),
  })
  .meta({
    title: 'Session response',
    description:
      'Successful authentication or refresh response. The separate httpOnly cookie carries the opaque refresh credential.',
    example: AuthExamples.session,
  });

export type SignUp = z.infer<typeof SignUpSchema>;

export type LogIn = z.infer<typeof LogInSchema>;

export type SessionEnvelope = z.infer<typeof SessionEnvelopeSchema>;

export const EmptyAuthBodySchema = z.strictObject({}).default({}).meta({
  title: 'Empty authentication request',
  description:
    'Refresh and logout accept an empty JSON object or no body. All supplied fields are rejected.',
  example: {},
});
