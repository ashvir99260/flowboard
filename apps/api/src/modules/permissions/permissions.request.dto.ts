import {
  ExpectedConfigSchema,
  GrantParamsSchema,
  NodeParamsSchema,
  PaginationQuerySchema,
  UpsertGrantSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class PermissionPageQueryDto extends createZodDto(PaginationQuerySchema) {}

export class GrantParamsDto extends createZodDto(GrantParamsSchema) {}

export class UpsertGrantDto extends createZodDto(UpsertGrantSchema) {}

export class GrantNodeParamsDto extends createZodDto(NodeParamsSchema) {}

export class GrantVersionDto extends createZodDto(ExpectedConfigSchema) {}
