import { GrantEnvelopeSchema, GrantPageSchema, TreePageSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class TreePageResponseDto extends createZodDto(TreePageSchema) {}

export class GrantPageResponseDto extends createZodDto(GrantPageSchema) {}

export class GrantResponseDto extends createZodDto(GrantEnvelopeSchema) {}
