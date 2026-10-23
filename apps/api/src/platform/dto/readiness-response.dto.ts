import { ReadinessSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class ReadinessResponseDto extends createZodDto(ReadinessSchema) {}
