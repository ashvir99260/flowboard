import {
  ErrorEnvelopeSchema,
  HealthQuerySchema,
  LivenessSchema,
  ReadinessSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class ErrorResponseDto extends createZodDto(ErrorEnvelopeSchema) {}
export class HealthQueryDto extends createZodDto(HealthQuerySchema) {}
export class LivenessResponseDto extends createZodDto(LivenessSchema) {}
export class ReadinessResponseDto extends createZodDto(ReadinessSchema) {}
