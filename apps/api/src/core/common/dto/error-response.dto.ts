import { ErrorEnvelopeSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class ErrorResponseDto extends createZodDto(ErrorEnvelopeSchema) {}
