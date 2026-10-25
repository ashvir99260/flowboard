import { SearchPageSchema } from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class SearchPageResponseDto extends createZodDto(SearchPageSchema) {}
