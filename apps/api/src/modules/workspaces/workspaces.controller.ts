import { AuthExamples, WorkspaceExamples } from '@flowboard/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';

import { SessionRoute } from '../../core/common/decorators/session-route.decorator.js';
import { EmptyQueryDto } from '../../core/common/dto/empty-query.dto.js';
import { ErrorResponseDto } from '../../core/common/dto/error-response.dto.js';
import { documentedError } from '../../core/common/swagger/api-documentation.js';
import { WorkspacePermission } from '../permissions/permission.decorator.js';

import {
  AcceptInvitationDto,
  AddMemberDto,
  CreateInvitationDto,
  ExpectedConfigDto,
  MemberPageQueryDto,
  MemberParamsDto,
  UpdateMemberDto,
  WorkspacePageQueryDto,
  WorkspaceParamsDto,
} from './workspaces.request.dto.js';
import {
  AcceptedInvitationResponseDto,
  CurrentUserResponseDto,
  InvitationResponseDto,
  MemberMutationResponseDto,
  MemberPageResponseDto,
  WorkspacePageResponseDto,
} from './workspaces.response.dto.js';
import { WorkspacesService } from './workspaces.service.js';

import type {
  CurrentUserEnvelope,
  MemberMutationEnvelope,
  MemberPage,
  WorkspacePage,
} from '@flowboard/contracts';
import type { AcceptedInvitationEnvelope, InvitationEnvelope } from '@flowboard/contracts';
import type { AuthenticatedIdentity, IdentitySession } from '@flowboard/database';

@ApiTags('Workspaces')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedError(401))
@ApiResponse({
  status: 403,
  type: ErrorResponseDto.Output,
  description: 'The current membership cannot perform this action.',
  example: { error: { code: 'FORBIDDEN', message: 'Access denied' } },
})
@ApiResponse({
  status: 404,
  type: ErrorResponseDto.Output,
  description: 'The workspace or member is not available to the caller.',
  example: { error: { code: 'NOT_FOUND', message: 'Member not found' } },
})
@ApiResponse({
  status: 409,
  type: ErrorResponseDto.Output,
  description:
    'Revision, last-administrator or membership conflict. Read current state before retrying.',
  example: { error: { code: 'CONFIG_CONFLICT', message: 'Workspace configuration changed' } },
})
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller()
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}
  @Post('workspaces/:workspaceId/invitations')
  @WorkspacePermission('member.manage')
  @ApiOperation({
    description:
      'Create a 48-hour single-use token for an exact normalized email and target role. Store only its digest; the administrator receives the raw token once for manual sharing.',
    operationId: 'createWorkspaceInvitation',
    summary: 'Create a private workspace invitation',
  })
  @ApiBody({
    type: CreateInvitationDto,
    description: 'Invited account email, target role and configuration revision.',
    examples: {
      invitation: {
        summary: 'Invite a member',
        value: { email: 'member@example.test', expectedConfigVersion: 1, role: 'member' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    type: InvitationResponseDto.Output,
    example: {
      configVersion: 2,
      data: {
        expiresAt: '2026-10-26T10:00:00.000Z',
        invitationId: '10000000-0000-4000-8000-000000000004',
        token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      },
    },
  })
  @ZodResponse({
    status: 201,
    type: InvitationResponseDto,
    description: 'One-time invitation secret, expiry and configuration revision.',
  })
  createInvitation(
    @Param() params: WorkspaceParamsDto,
    @Body() input: CreateInvitationDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<InvitationEnvelope> {
    return this.workspaces.createInvitation(request.identity, params.workspaceId, input);
  }
  @Post('invitations/accept')
  @HttpCode(200)
  @SessionRoute()
  @ApiOperation({
    description:
      'Match the authenticated account email, token digest, unused state and 48-hour expiry atomically. Rejected or already-member invitations never change a role. Acceptance does not switch the current workspace.',
    operationId: 'acceptWorkspaceInvitation',
    summary: 'Accept an invitation with a matching account',
  })
  @ApiBody({
    type: AcceptInvitationDto,
    description: 'Private invitation token supplied in the body, never in a query string.',
    examples: {
      invitation: {
        summary: 'Accept a shared token',
        value: { token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: AcceptedInvitationResponseDto.Output,
    example: { data: AuthExamples.session.data.activeWorkspace },
  })
  @ZodResponse({
    status: 200,
    type: AcceptedInvitationResponseDto,
    description: 'Joined workspace and role; session selection is unchanged.',
  })
  acceptInvitation(
    @Body() input: AcceptInvitationDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: AuthenticatedIdentity },
  ): Promise<AcceptedInvitationEnvelope> {
    return this.workspaces.acceptInvitation(request.identity, input.token);
  }
  @Post('workspaces/:workspaceId/members')
  @WorkspacePermission('member.manage')
  @ApiOperation({
    description:
      'Administrators add a normalized existing account email with a workspace-local target role. Authorization and the expected revision are rechecked inside the workspace transaction.',
    operationId: 'addWorkspaceMember',
    summary: 'Add an existing account to this workspace',
  })
  @ApiBody({
    type: AddMemberDto,
    description: 'Existing account, target role and last-read configuration revision.',
    examples: {
      member: {
        summary: 'Add a member',
        value: { email: 'member@example.test', expectedConfigVersion: 1, role: 'member' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    type: MemberMutationResponseDto.Output,
    example: {
      data: {
        createdAt: '2026-10-24T10:00:00.000Z',
        name: 'Alex Rivera',
        role: 'member',
        updatedAt: '2026-10-24T10:00:00.000Z',
        userId: '10000000-0000-4000-8000-000000000001',
      },
      configVersion: 2,
    },
  })
  @ZodResponse({
    status: 201,
    type: MemberMutationResponseDto,
    description: 'Created membership and updated configuration revision.',
  })
  addMember(
    @Param() params: WorkspaceParamsDto,
    @Body() input: AddMemberDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<MemberMutationEnvelope> {
    return this.workspaces.addMember(request.identity, params.workspaceId, input);
  }
  @Patch('workspaces/:workspaceId/members/:userId')
  @WorkspacePermission('member.manage')
  @ApiOperation({
    description:
      'Change only the target role under the workspace lock. Preserve at least one administrator and reject stale revisions. An unchanged role preserves the revision.',
    operationId: 'updateWorkspaceMember',
    summary: 'Change a workspace member’s role',
  })
  @ApiBody({
    type: UpdateMemberDto,
    description: 'New role and last-read configuration revision.',
    examples: {
      role: { summary: 'Promote a member', value: { expectedConfigVersion: 1, role: 'admin' } },
    },
  })
  @ApiResponse({
    status: 200,
    type: MemberMutationResponseDto.Output,
    example: {
      data: {
        createdAt: '2026-10-24T10:00:00.000Z',
        name: 'Alex Rivera',
        role: 'admin',
        updatedAt: '2026-10-24T10:00:00.000Z',
        userId: '10000000-0000-4000-8000-000000000001',
      },
      configVersion: 2,
    },
  })
  @ZodResponse({
    status: 200,
    type: MemberMutationResponseDto,
    description: 'Current membership and configuration revision.',
  })
  updateMember(
    @Param() params: MemberParamsDto,
    @Body() input: UpdateMemberDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<MemberMutationEnvelope> {
    return this.workspaces.updateMember(request.identity, params.workspaceId, params.userId, input);
  }
  @Delete('workspaces/:workspaceId/members/:userId')
  @HttpCode(204)
  @WorkspacePermission('member.manage')
  @ApiOperation({
    description:
      'Atomically remove membership, grants and assignments. Version affected tasks and persist outbox updates; retain history. The last administrator cannot be removed.',
    operationId: 'removeWorkspaceMember',
    summary: 'Remove a member and their workspace access',
  })
  @ApiBody({
    type: ExpectedConfigDto,
    description: 'Last-read configuration revision required for deletion.',
    examples: {
      revision: { summary: 'Delete at a known revision', value: { expectedConfigVersion: 1 } },
    },
  })
  @ApiNoContentResponse({
    description: 'Membership and dependent access removed. Historical activity is retained.',
  })
  async removeMember(
    @Param() params: MemberParamsDto,
    @Body() input: ExpectedConfigDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<void> {
    await this.workspaces.removeMember(
      request.identity,
      params.workspaceId,
      params.userId,
      input.expectedConfigVersion,
    );
  }
  @Get('workspaces')
  @SessionRoute()
  @ApiOperation({
    description:
      'Live keyset page ordered by membership creation time and workspace ID. The signed cursor is bound to this caller and query.',
    operationId: 'listWorkspaces',
    summary: 'List your workspace memberships',
  })
  @ZodResponse({
    status: 200,
    type: WorkspacePageResponseDto,
    description: 'Authorized workspace page.',
  })
  @ApiResponse({
    status: 200,
    type: WorkspacePageResponseDto.Output,
    example: { items: [], pageInfo: { hasNextPage: false, nextCursor: null } },
  })
  listWorkspaces(
    @Query() query: WorkspacePageQueryDto,
    @Req() request: { identity: IdentitySession },
  ): Promise<WorkspacePage> {
    return this.workspaces.listWorkspaces(request.identity, query);
  }
  @Get('workspaces/:workspaceId/members')
  @WorkspacePermission('member.list')
  @ApiOperation({
    description:
      'Revision-bound keyset page. Optional assignableToListId includes only members with full ancestor visibility to that list. Administrators see emails; ordinary members see only their own email.',
    operationId: 'listWorkspaceMembers',
    summary: 'List members in the active workspace',
  })
  @ZodResponse({
    status: 200,
    type: MemberPageResponseDto,
    description: 'Member page and current configuration revision.',
  })
  @ApiResponse({
    status: 200,
    type: MemberPageResponseDto.Output,
    example: { items: [], pageInfo: { hasNextPage: false, nextCursor: null }, configVersion: 1 },
  })
  listMembers(
    @Param() params: WorkspaceParamsDto,
    @Query() query: MemberPageQueryDto,
    @Req() request: { identity: IdentitySession },
  ): Promise<MemberPage> {
    return this.workspaces.listMembers(request.identity, params.workspaceId, query);
  }
  @Get('me')
  @SessionRoute()
  @ApiOperation({
    description:
      'Verify the access JWT and live session family. Return the current workspace only if its membership still exists; session-only recovery remains available after removal.',
    operationId: 'getCurrentUser',
    summary: 'Read the current user and workspace',
  })
  @ApiResponse({
    status: 200,
    type: CurrentUserResponseDto.Output,
    example: WorkspaceExamples.currentUser,
  })
  @ZodResponse({
    status: 200,
    type: CurrentUserResponseDto,
    description: 'Safe current identity without credentials.',
  })
  getCurrentUser(
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): CurrentUserEnvelope {
    const { user, activeWorkspace } = request.identity;
    const audit = <T extends { createdAt: Date; updatedAt: Date }>(record: T) => ({
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    });

    return {
      data: { user: audit(user), activeWorkspace: activeWorkspace ? audit(activeWorkspace) : null },
    };
  }
}
