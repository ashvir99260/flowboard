import { SearchWorkspaceQuerySchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class SearchWorkspaceQueryDto extends createZodDto(SearchWorkspaceQuerySchema) {}
