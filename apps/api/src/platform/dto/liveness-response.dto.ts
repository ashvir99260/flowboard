import { LivenessSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class LivenessResponseDto extends createZodDto(LivenessSchema) {}
