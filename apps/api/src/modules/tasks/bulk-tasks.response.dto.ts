import { BulkTaskMutationEnvelopeSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class BulkTaskMutationResponseDto extends createZodDto(BulkTaskMutationEnvelopeSchema) {}
