import { ActivityPageSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class ActivityPageResponseDto extends createZodDto(ActivityPageSchema) {}
