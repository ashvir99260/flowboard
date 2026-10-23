import { z } from 'zod';

import { ActiveWorkspaceSchema, AuthExamples, UserSelfSchema } from './auth.js';
import { TimestampSchema } from './dates.js';
import { WorkspaceRoleSchema } from './enums.js';
import { EmailSchema, NameSchema, UuidSchema, VersionSchema } from './identifiers.js';
import { cursorPageSchema, PaginationQuerySchema } from './pagination.js';

export const WorkspaceExamples = {
  currentUser: {
    data: {
      activeWorkspace: AuthExamples.session.data.activeWorkspace,
      user: AuthExamples.session.data.user,
    },
  },
};

export const CurrentUserEnvelopeSchema = z
  .strictObject({
    data: z
      .strictObject({
        activeWorkspace: ActiveWorkspaceSchema.nullable().meta({
          title: 'Current workspace',
          description:
            'Selected workspace with current membership, or null if that membership is gone.',
          example: AuthExamples.session.data.activeWorkspace,
        }),
        user: UserSelfSchema,
      })
      .meta({
        title: 'Current identity',
        description: 'Safe current user and selected workspace projection.',
        example: WorkspaceExamples.currentUser.data,
      }),
  })
  .meta({
    title: 'Current user response',
    description: 'Authenticated session identity without access or refresh credentials.',
    example: WorkspaceExamples.currentUser,
  });

export type CurrentUserEnvelope = z.infer<typeof CurrentUserEnvelopeSchema>;

export const WorkspaceParamsSchema = z
  .strictObject({
    workspaceId: UuidSchema.overwrite((value) => value.toLowerCase()).meta({
      title: 'Workspace ID',
      description: 'Must equal the authenticated session’s active workspace.',
      example: AuthExamples.session.data.activeWorkspace.id,
    }),
  })
  .meta({
    title: 'Workspace route parameters',
    description: 'Explicit workspace scope checked against the session.',
    example: { workspaceId: AuthExamples.session.data.activeWorkspace.id },
  });

export const MemberSchema = z
  .strictObject({
    userId: UuidSchema.meta({
      title: 'User ID',
      description: 'Stable member user identifier.',
      example: AuthExamples.session.data.user.id,
    }),
    name: NameSchema.meta({
      description: 'The member’s display name.',
      example: 'Alex Rivera',
      title: 'Member name',
    }),
    email: EmailSchema.optional().meta({
      description: 'Included only for administrators or the member themselves.',
      example: 'alex@example.test',
      title: 'Member email',
    }),
    role: WorkspaceRoleSchema.meta({
      description: 'Role in this workspace, read from current membership.',
      example: 'member',
      title: 'Membership role',
    }),
    createdAt: TimestampSchema.meta({
      description: 'Server-owned membership creation timestamp.',
      example: '2026-10-24T10:00:00.000Z',
      title: 'Membership created at',
    }),
    updatedAt: TimestampSchema.meta({
      description: 'Server-owned last membership update timestamp.',
      example: '2026-10-24T10:00:00.000Z',
      title: 'Membership updated at',
    }),
  })
  .meta({
    title: 'Workspace member',
    description: 'Safe membership projection with restricted email visibility.',
    example: {
      userId: AuthExamples.session.data.user.id,
      name: 'Alex Rivera',
      role: 'member',
      createdAt: '2026-10-24T10:00:00.000Z',
      updatedAt: '2026-10-24T10:00:00.000Z',
    },
  });

export const ConfigVersionSchema = VersionSchema.meta({
  description: 'Workspace configuration revision. Mutations must send the version last read.',
  example: 1,
  title: 'Configuration version',
});

export const WorkspacePageSchema = cursorPageSchema(ActiveWorkspaceSchema).meta({
  title: 'Workspace page',
  description: 'Live cursor page of the caller’s memberships.',
  example: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
});

export const MemberPageSchema = cursorPageSchema(MemberSchema)
  .extend({ configVersion: ConfigVersionSchema })
  .meta({
    title: 'Member page',
    description: 'Revision-bound cursor page of visible member profiles.',
    example: { items: [], pageInfo: { hasNextPage: false, nextCursor: null }, configVersion: 1 },
  });

export const WorkspacePageQuerySchema = PaginationQuerySchema;

export type WorkspacePage = z.infer<typeof WorkspacePageSchema>;

export type MemberPage = z.infer<typeof MemberPageSchema>;

export type Member = z.infer<typeof MemberSchema>;

export const ExpectedConfigSchema = z
  .strictObject({ expectedConfigVersion: ConfigVersionSchema })
  .meta({
    title: 'Configuration precondition',
    description: 'Required revision check for workspace mutations.',
    example: { expectedConfigVersion: 1 },
  });

export const AddMemberSchema = ExpectedConfigSchema.extend({
  email: EmailSchema.meta({
    description: 'Normalized email of the account to add.',
    example: 'member@example.test',
    title: 'Existing account email',
  }),
  role: MemberSchema.shape.role,
}).meta({
  title: 'Add workspace member request',
  description: 'Administrator adds an existing account with a workspace-local role.',
  example: { email: 'member@example.test', expectedConfigVersion: 1, role: 'member' },
});

export const UpdateMemberSchema = ExpectedConfigSchema.extend({
  role: MemberSchema.shape.role,
}).meta({
  title: 'Update membership request',
  description: 'Change the target membership role without removing the last administrator.',
  example: { expectedConfigVersion: 1, role: 'admin' },
});

export const MemberParamsSchema = WorkspaceParamsSchema.extend({
  userId: MemberSchema.shape.userId,
}).meta({
  title: 'Member route parameters',
  description: 'Target workspace and member user identifier.',
  example: {
    workspaceId: AuthExamples.session.data.activeWorkspace.id,
    userId: AuthExamples.session.data.user.id,
  },
});

export const MemberMutationEnvelopeSchema = z
  .strictObject({ data: MemberSchema, configVersion: ConfigVersionSchema })
  .meta({
    title: 'Member mutation response',
    description: 'Resulting safe member profile and workspace revision.',
    example: {
      data: {
        userId: AuthExamples.session.data.user.id,
        name: 'Alex Rivera',
        role: 'member',
        createdAt: '2026-10-24T10:00:00.000Z',
        updatedAt: '2026-10-24T10:00:00.000Z',
      },
      configVersion: 2,
    },
  });

export type AddMember = z.infer<typeof AddMemberSchema>;

export type UpdateMember = z.infer<typeof UpdateMemberSchema>;

export type MemberMutationEnvelope = z.infer<typeof MemberMutationEnvelopeSchema>;

export const CreateInvitationSchema = AddMemberSchema.meta({
  title: 'Create invitation request',
  description: 'Create a 48-hour single-use invitation for this email and role.',
  example: { email: 'member@example.test', expectedConfigVersion: 1, role: 'member' },
});

const invitationToken = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/)
  .meta({
    description:
      'Opaque invitation secret. Share privately and never include in URL query parameters.',
    example: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    title: 'Invitation token',
  });

export const AcceptInvitationSchema = z
  .strictObject({
    token: invitationToken.meta({
      description: 'Single-use invitation secret, supplied only in the request body.',
      example: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      title: 'Invitation token',
      writeOnly: true,
    }),
  })
  .meta({
    title: 'Accept invitation request',
    description:
      'Join using a matching authenticated account email; do not automatically switch workspace.',
    example: { token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  });

export const InvitationEnvelopeSchema = z
  .strictObject({
    configVersion: ConfigVersionSchema,
    data: z
      .strictObject({
        invitationId: UuidSchema.meta({
          description: 'Server-generated invitation identifier.',
          example: '10000000-0000-4000-8000-000000000004',
          title: 'Invitation ID',
        }),
        token: invitationToken,
        expiresAt: TimestampSchema.meta({
          description: 'Database-clock expiry, 48 hours after creation.',
          example: '2026-10-26T10:00:00.000Z',
          title: 'Invitation expiry',
        }),
      })
      .meta({
        title: 'Created invitation',
        description: 'The raw token is returned only by this creation response.',
        example: {
          expiresAt: '2026-10-26T10:00:00.000Z',
          invitationId: '10000000-0000-4000-8000-000000000004',
          token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        },
      }),
  })
  .meta({
    title: 'Invitation response',
    description: 'Created invitation and current configuration revision.',
    example: {
      configVersion: 2,
      data: {
        expiresAt: '2026-10-26T10:00:00.000Z',
        invitationId: '10000000-0000-4000-8000-000000000004',
        token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    },
  });

export const AcceptedInvitationEnvelopeSchema = z
  .strictObject({ data: ActiveWorkspaceSchema })
  .meta({
    title: 'Accepted invitation response',
    description: 'Joined workspace and role; current session selection is unchanged.',
    example: { data: AuthExamples.session.data.activeWorkspace },
  });

export const SwitchWorkspaceSchema = WorkspaceParamsSchema.extend({
  workspaceId: WorkspaceParamsSchema.shape.workspaceId.meta({
    title: 'Destination workspace ID',
    description:
      'Destination workspace where the authenticated account has current membership; may differ from the active workspace.',
    example: AuthExamples.session.data.activeWorkspace.id,
  }),
}).meta({
  title: 'Switch workspace request',
  description: 'Select a workspace where the authenticated account has current membership.',
  example: { workspaceId: AuthExamples.session.data.activeWorkspace.id },
});

export type CreateInvitation = z.infer<typeof CreateInvitationSchema>;

export type InvitationEnvelope = z.infer<typeof InvitationEnvelopeSchema>;

export type AcceptedInvitationEnvelope = z.infer<typeof AcceptedInvitationEnvelopeSchema>;
