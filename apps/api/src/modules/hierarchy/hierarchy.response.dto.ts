import { NodeEnvelopeSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class NodeResponseDto extends createZodDto(NodeEnvelopeSchema) {}
