import {
  ResolvedFieldCollectionSchema,
  ScopeFieldCollectionSchema,
  ScopeFieldEnvelopeSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class ScopeFieldResponseDto extends createZodDto(ScopeFieldCollectionSchema) {}

export class ResolvedFieldResponseDto extends createZodDto(ResolvedFieldCollectionSchema) {}

export class ScopeFieldMutationResponseDto extends createZodDto(ScopeFieldEnvelopeSchema) {}
