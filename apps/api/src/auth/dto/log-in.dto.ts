import { LogInSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class LogInDto extends createZodDto(LogInSchema) {}
