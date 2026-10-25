import {
  CurrentUserEnvelopeSchema,
  MemberMutationEnvelopeSchema,
  MemberPageSchema,
  WorkspaceEnvelopeSchema,
  WorkspacePageSchema,
} from '@flowboard/contracts';
import { AcceptedInvitationEnvelopeSchema, InvitationEnvelopeSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class CurrentUserResponseDto extends createZodDto(CurrentUserEnvelopeSchema) {}

export class WorkspacePageResponseDto extends createZodDto(WorkspacePageSchema) {}

export class MemberPageResponseDto extends createZodDto(MemberPageSchema) {}

export class MemberMutationResponseDto extends createZodDto(MemberMutationEnvelopeSchema) {}

export class InvitationResponseDto extends createZodDto(InvitationEnvelopeSchema) {}

export class AcceptedInvitationResponseDto extends createZodDto(AcceptedInvitationEnvelopeSchema) {}

export class WorkspaceResponseDto extends createZodDto(WorkspaceEnvelopeSchema) {}
