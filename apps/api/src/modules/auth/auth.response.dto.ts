import { SessionEnvelopeSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class SessionResponseDto extends createZodDto(SessionEnvelopeSchema) {}
