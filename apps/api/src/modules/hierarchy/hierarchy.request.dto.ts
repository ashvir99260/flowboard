import {
  CreateNodeSchema,
  MoveNodeSchema,
  NodeParamsSchema,
  NodeVersionSchema,
  ReorderNodeSchema,
  UpdateNodeSchema,
} from '@flowboard/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateNodeDto extends createZodDto(CreateNodeSchema) {}

export class NodeParamsDto extends createZodDto(NodeParamsSchema) {}

export class UpdateNodeDto extends createZodDto(UpdateNodeSchema) {}

export class NodeVersionDto extends createZodDto(NodeVersionSchema) {}

export class ReorderNodeDto extends createZodDto(ReorderNodeSchema) {}

export class MoveNodeDto extends createZodDto(MoveNodeSchema) {}
