import { NodeExamples } from '@flowboard/contracts';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';

import { EmptyQueryDto } from '../../core/common/dto/empty-query.dto.js';
import { ErrorResponseDto } from '../../core/common/dto/error-response.dto.js';
import { documentedError } from '../../core/common/swagger/api-documentation.js';
import { ActiveWorkspacePermission, NodePermission } from '../permissions/permission.decorator.js';

import {
  CreateNodeDto,
  NodeParamsDto,
  NodeVersionDto,
  UpdateNodeDto,
} from './hierarchy.request.dto.js';
import { NodeResponseDto } from './hierarchy.response.dto.js';
import { HierarchyService } from './hierarchy.service.js';

import type { NodeEnvelope } from '@flowboard/contracts';
import type { IdentitySession } from '@flowboard/database';

const responseExample = { data: NodeExamples.node, configVersion: 2, dataVersion: 2 };

@ApiTags('Hierarchy')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse({
  status: 401,
  type: ErrorResponseDto.Output,
  description: 'A valid access token and current membership are required.',
  example: { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
})
@ApiResponse({
  status: 403,
  type: ErrorResponseDto.Output,
  description: 'The member cannot access this container or perform this administrative action.',
  example: { error: { code: 'FORBIDDEN', message: 'Access denied' } },
})
@ApiResponse({
  status: 404,
  type: ErrorResponseDto.Output,
  description: 'The container or a live ancestor is missing or outside the selected workspace.',
  example: { error: { code: 'NOT_FOUND', message: 'Container not found' } },
})
@ApiResponse({
  status: 409,
  type: ErrorResponseDto.Output,
  description:
    'The workspace configuration or node version changed; read current state before retrying.',
  example: { error: { code: 'CONFIG_CONFLICT', message: 'Workspace configuration changed' } },
})
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller('nodes')
export class NodesController {
  constructor(private readonly hierarchy: HierarchyService) {}
  @Post()
  @ActiveWorkspacePermission('container.write')
  @ApiOperation({
    description:
      'Append a space, folder or list under its required live parent in the selected workspace. Administrator access and the current configuration revision are required.',
    operationId: 'createNode',
    summary: 'Create a hierarchy container',
  })
  @ApiBody({
    type: CreateNodeDto,
    description: 'Name, container type, required parent and workspace configuration precondition.',
    examples: { space: { summary: 'Create a root space', value: NodeExamples.create } },
  })
  @ApiResponse({ status: 201, type: NodeResponseDto.Output, example: responseExample })
  @ZodResponse({
    status: 201,
    type: NodeResponseDto,
    description: 'Created container and updated workspace revisions.',
  })
  create(
    @Body() input: CreateNodeDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<NodeEnvelope> {
    return this.hierarchy.create(request.identity, input);
  }
  @Get(':nodeId')
  @NodePermission('container.read')
  @ApiOperation({
    description:
      'Read a container in the selected workspace. Members require access through every ancestor; administrators bypass tenant-local grants.',
    operationId: 'getNode',
    summary: 'Read a live hierarchy container',
  })
  @ApiResponse({ status: 200, type: NodeResponseDto.Output, example: responseExample })
  @ZodResponse({
    status: 200,
    type: NodeResponseDto,
    description: 'Container and workspace revisions from the same snapshot.',
  })
  find(
    @Param() params: NodeParamsDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<NodeEnvelope> {
    return this.hierarchy.find(request.identity, params.nodeId);
  }
  @Patch(':nodeId')
  @NodePermission('container.write')
  @ApiOperation({
    description:
      'Change the name or visibility of a live container using node and workspace revisions. A no-op preserves timestamps and versions. Reparenting is not supported by this endpoint.',
    operationId: 'updateNode',
    summary: 'Update a hierarchy container',
  })
  @ApiBody({
    type: UpdateNodeDto,
    description: 'Changed name or visibility and both required version preconditions.',
    examples: {
      rename: {
        summary: 'Rename a container',
        value: { expectedConfigVersion: 2, expectedVersion: 1, name: 'Engineering team' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: NodeResponseDto.Output,
    example: {
      ...responseExample,
      data: { ...NodeExamples.node, name: 'Engineering team', version: 2 },
      configVersion: 3,
      dataVersion: 3,
    },
  })
  @ZodResponse({
    status: 200,
    type: NodeResponseDto,
    description: 'Updated container and workspace revisions.',
  })
  update(
    @Param() params: NodeParamsDto,
    @Body() input: UpdateNodeDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<NodeEnvelope> {
    return this.hierarchy.update(request.identity, params.nodeId, input);
  }

  @Delete(':nodeId')
  @HttpCode(204)
  @NodePermission('container.write')
  @ApiOperation({
    description:
      'Atomically archive the live container, descendant containers and their live tasks. Preserve historical data and existing archived rows; repeated archive returns 404.',
    operationId: 'archiveNode',
    summary: 'Archive a hierarchy subtree',
  })
  @ApiBody({
    type: NodeVersionDto,
    description: 'Expected node and workspace configuration revisions.',
    examples: {
      archive: {
        summary: 'Archive the current version',
        value: { expectedConfigVersion: 2, expectedVersion: 1 },
      },
    },
  })
  @ApiNoContentResponse({
    description: 'Subtree archived and invalidations recorded atomically; no response body.',
  })
  async archive(
    @Param() params: NodeParamsDto,
    @Body() input: NodeVersionDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<void> {
    await this.hierarchy.archive(request.identity, params.nodeId, input);
  }
}
