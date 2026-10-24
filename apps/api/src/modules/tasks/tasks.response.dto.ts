import { TaskEnvelopeSchema, TaskPageSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class TaskResponseDto extends createZodDto(TaskEnvelopeSchema) {}

export class TaskPageResponseDto extends createZodDto(TaskPageSchema) {}
