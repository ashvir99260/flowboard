import { EmptyAuthBodySchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class EmptyAuthBodyDto extends createZodDto(EmptyAuthBodySchema) {}
