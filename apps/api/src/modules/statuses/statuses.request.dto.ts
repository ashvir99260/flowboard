import {
  CreateScopeStatusSchema,
  ExpectedConfigSchema,
  ListStatusParamsSchema,
  ScopeStatusParamsSchema,
  StatusScopeSchema,
  UpdateScopeStatusSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class StatusScopeDto extends createZodDto(StatusScopeSchema) {}

export class ListStatusParamsDto extends createZodDto(ListStatusParamsSchema) {}

// A root union cannot be a TypeScript class base; retain its exact type and Swagger name.
export const CreateScopeStatusDto = createZodDto(CreateScopeStatusSchema);

Object.defineProperty(CreateScopeStatusDto, 'name', { value: 'CreateScopeStatusDto' });

export type CreateScopeStatusDto = InstanceType<typeof CreateScopeStatusDto>;

export class UpdateScopeStatusDto extends createZodDto(UpdateScopeStatusSchema) {}

export class RemoveScopeStatusDto extends createZodDto(ExpectedConfigSchema) {}

export class ScopeStatusParamsDto extends createZodDto(ScopeStatusParamsSchema) {}
