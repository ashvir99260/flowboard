import {
  CreateNodeSchema,
  NodeParamsSchema,
  NodeVersionSchema,
  UpdateNodeSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateNodeDto extends createZodDto(CreateNodeSchema) {}

export class NodeParamsDto extends createZodDto(NodeParamsSchema) {}

export class UpdateNodeDto extends createZodDto(UpdateNodeSchema) {}

export class NodeVersionDto extends createZodDto(NodeVersionSchema) {}
