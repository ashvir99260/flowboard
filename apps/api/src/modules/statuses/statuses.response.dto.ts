import {
  ResolvedStatusCollectionSchema,
  ScopeStatusCollectionSchema,
  ScopeStatusEnvelopeSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class ScopeStatusResponseDto extends createZodDto(ScopeStatusCollectionSchema) {}

export class ResolvedStatusResponseDto extends createZodDto(ResolvedStatusCollectionSchema) {}

export class ScopeStatusMutationResponseDto extends createZodDto(ScopeStatusEnvelopeSchema) {}
