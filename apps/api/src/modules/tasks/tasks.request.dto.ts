import { ListTasksQuerySchema, TaskListParamsSchema, TaskParamsSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class ListTasksQueryDto extends createZodDto(ListTasksQuerySchema) {}

export class TaskParamsDto extends createZodDto(TaskParamsSchema) {}

export class TaskListParamsDto extends createZodDto(TaskListParamsSchema) {}
