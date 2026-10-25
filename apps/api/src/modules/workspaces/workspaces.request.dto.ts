import {
  AddMemberSchema,
  ExpectedConfigSchema,
  MemberPageQuerySchema,
  MemberParamsSchema,
  UpdateMemberSchema,
  UpdateWorkspaceSchema,
  WorkspacePageQuerySchema,
  WorkspaceParamsSchema,
} from '@flowboard/contracts';
import { AcceptInvitationSchema, CreateInvitationSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class WorkspacePageQueryDto extends createZodDto(WorkspacePageQuerySchema) {}

export class WorkspaceParamsDto extends createZodDto(WorkspaceParamsSchema) {}

export class AddMemberDto extends createZodDto(AddMemberSchema) {}

export class UpdateMemberDto extends createZodDto(UpdateMemberSchema) {}

export class ExpectedConfigDto extends createZodDto(ExpectedConfigSchema) {}

export class MemberParamsDto extends createZodDto(MemberParamsSchema) {}

export class CreateInvitationDto extends createZodDto(CreateInvitationSchema) {}

export class AcceptInvitationDto extends createZodDto(AcceptInvitationSchema) {}

export class MemberPageQueryDto extends createZodDto(MemberPageQuerySchema) {}

export class UpdateWorkspaceDto extends createZodDto(UpdateWorkspaceSchema) {}
