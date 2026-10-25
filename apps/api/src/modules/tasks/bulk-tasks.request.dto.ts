import { BulkUpdateTasksSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class BulkUpdateTasksDto extends createZodDto(BulkUpdateTasksSchema) {}
