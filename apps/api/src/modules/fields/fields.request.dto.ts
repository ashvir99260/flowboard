import {
  CreateScopeFieldSchema,
  ExpectedConfigSchema,
  FieldScopeSchema,
  ListFieldParamsSchema,
  ScopeFieldParamsSchema,
  UpdateScopeFieldSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class FieldScopeDto extends createZodDto(FieldScopeSchema) {}

export class ListFieldParamsDto extends createZodDto(ListFieldParamsSchema) {}

export class CreateScopeFieldDto extends createZodDto(CreateScopeFieldSchema) {}

export class UpdateScopeFieldDto extends createZodDto(UpdateScopeFieldSchema) {}

export class RemoveScopeFieldDto extends createZodDto(ExpectedConfigSchema) {}

export class ScopeFieldParamsDto extends createZodDto(ScopeFieldParamsSchema) {}
