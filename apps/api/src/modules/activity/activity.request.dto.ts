import { ActivityQuerySchema, TaskParamsSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class ActivityQueryDto extends createZodDto(ActivityQuerySchema) {}

export class ActivityTaskParamsDto extends createZodDto(TaskParamsSchema) {}
