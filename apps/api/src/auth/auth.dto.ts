import {
  EmptyAuthBodySchema,
  LogInSchema,
  SessionEnvelopeSchema,
  SignUpSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class SignUpDto extends createZodDto(SignUpSchema) {}
export class LogInDto extends createZodDto(LogInSchema) {}
export class SessionResponseDto extends createZodDto(SessionEnvelopeSchema) {}

export class EmptyAuthBodyDto extends createZodDto(EmptyAuthBodySchema) {}
