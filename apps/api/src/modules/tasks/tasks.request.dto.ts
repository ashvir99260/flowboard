import {
  ArchiveTaskSchema,
  CreateTaskSchema,
  ListTasksQuerySchema,
  TaskListParamsSchema,
  TaskParamsSchema,
  UpdateTaskSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class ListTasksQueryDto extends createZodDto(ListTasksQuerySchema) {}

export class TaskParamsDto extends createZodDto(TaskParamsSchema) {}

export class TaskListParamsDto extends createZodDto(TaskListParamsSchema) {}

export class CreateTaskDto extends createZodDto(CreateTaskSchema) {}

export class UpdateTaskDto extends createZodDto(UpdateTaskSchema) {}

export class ArchiveTaskDto extends createZodDto(ArchiveTaskSchema) {}
