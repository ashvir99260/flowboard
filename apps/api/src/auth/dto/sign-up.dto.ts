import { SignUpSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class SignUpDto extends createZodDto(SignUpSchema) {}
