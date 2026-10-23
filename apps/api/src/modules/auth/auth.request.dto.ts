import { EmptyAuthBodySchema, LogInSchema, SignUpSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class EmptyAuthBodyDto extends createZodDto(EmptyAuthBodySchema) {}

export class LogInDto extends createZodDto(LogInSchema) {}

export class SignUpDto extends createZodDto(SignUpSchema) {}
