import { HealthQuerySchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class EmptyQueryDto extends createZodDto(HealthQuerySchema) {}
