import { LivenessSchema, ReadinessSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class LivenessResponseDto extends createZodDto(LivenessSchema) {}

export class ReadinessResponseDto extends createZodDto(ReadinessSchema) {}
