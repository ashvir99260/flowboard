import {
  CreateScopeStatusSchema,
  ExpectedConfigSchema,
  ResolvedStatusCollectionSchema,
  ScopeStatusCollectionSchema,
  ScopeStatusEnvelopeSchema,
  UpdateScopeStatusSchema,
} from '@flowboard/contracts';
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

import { EmptyQueryDto } from '../../core/common/dto/empty-query.dto.ts';
import {
  documentedAccessError,
  documentedError,
} from '../../core/common/swagger/api-documentation.ts';
import { NodePermission, ScopePermission } from '../permissions/permission.decorator.ts';

import {
  CreateScopeStatusDto,
  ListStatusParamsDto,
  RemoveScopeStatusDto,
  ScopeStatusParamsDto,
  StatusScopeDto,
  UpdateScopeStatusDto,
} from './statuses.request.dto.ts';
import {
  ResolvedStatusResponseDto,
  ScopeStatusMutationResponseDto,
  ScopeStatusResponseDto,
} from './statuses.response.dto.ts';
import { StatusesService } from './statuses.service.ts';

import type { IdentitySession } from '@flowboard/database';

@ApiTags('Statuses')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedError(404))
@ApiResponse(documentedAccessError(409))
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller('scopes/:ownerType/:ownerId/statuses')
export class ScopeStatusesController {
  constructor(private readonly statuses: StatusesService) {}
  @Get()
  @ScopePermission('configuration.read')
  @ApiOperation({
    description:
      'Administrators read the complete bounded local collection and verified ancestor scopes, with its snapshot configuration revision.',
    operationId: 'listScopeStatuses',
    summary: 'Read local status configuration',
  })
  @ApiResponse({
    status: 200,
    type: ScopeStatusResponseDto.Output,
    example: ScopeStatusCollectionSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: ScopeStatusResponseDto,
    description: 'Local rows and ancestor scope metadata.',
  })
  list(
    @Param() owner: StatusScopeDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.statuses.list(request.identity, owner);
  }
  @Post()
  @ScopePermission('configuration.write')
  @ApiOperation({
    description:
      'Define or override a stable identity after validating the owner, all live descendants and their task references under one workspace lock.',
    operationId: 'createScopeStatus',
    summary: 'Create local status configuration',
  })
  @ApiBody({
    type: CreateScopeStatusDto,
    description: 'Definition or inherited override with expected configuration revision.',
    examples: {
      define: { summary: 'Add review status', value: CreateScopeStatusSchema.meta()?.example },
    },
  })
  @ApiResponse({
    status: 201,
    type: ScopeStatusMutationResponseDto.Output,
    example: ScopeStatusEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 201,
    type: ScopeStatusMutationResponseDto,
    description: 'Created local configuration and committed revision.',
  })
  create(
    @Param() owner: StatusScopeDto,
    @Body(new ZodValidationPipe(CreateScopeStatusDto)) input: CreateScopeStatusDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.statuses.create(request.identity, owner, input);
  }
  @Patch(':statusId')
  @ScopePermission('configuration.write')
  @ApiOperation({
    description:
      'Patch a local row by canonical status ID. Omitted values are preserved and null inherits; effective descendants and live tasks must remain valid.',
    operationId: 'updateScopeStatus',
    summary: 'Update local status configuration',
  })
  @ApiBody({
    type: UpdateScopeStatusDto,
    description: 'Display or visibility changes with expected configuration revision.',
    examples: {
      rename: { summary: 'Rename local status', value: UpdateScopeStatusSchema.meta()?.example },
    },
  })
  @ApiResponse({
    status: 200,
    type: ScopeStatusMutationResponseDto.Output,
    example: ScopeStatusEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: ScopeStatusMutationResponseDto,
    description: 'Updated local row and committed revision; no-op preserves both.',
  })
  update(
    @Param() params: ScopeStatusParamsDto,
    @Body() input: UpdateScopeStatusDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    const owner = { ownerType: params.ownerType, ownerId: params.ownerId };

    return this.statuses.update(request.identity, owner, params.statusId, input);
  }
  @Delete(':statusId')
  @HttpCode(204)
  @ScopePermission('configuration.write')
  @ApiOperation({
    description:
      'Remove only the local display row after checking fallback and live descendants. Canonical identity and historical task references are retained.',
    operationId: 'removeScopeStatus',
    summary: 'Remove local status configuration',
  })
  @ApiBody({
    type: RemoveScopeStatusDto,
    description: 'Expected configuration revision for this removal.',
    examples: {
      remove: { summary: 'Remove current local row', value: ExpectedConfigSchema.meta()?.example },
    },
  })
  @ApiNoContentResponse({
    description: 'Local row removed and configuration invalidation recorded atomically.',
  })
  async remove(
    @Param() params: ScopeStatusParamsDto,
    @Body() input: RemoveScopeStatusDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<void> {
    const owner = { ownerType: params.ownerType, ownerId: params.ownerId };
    await this.statuses.remove(request.identity, owner, params.statusId, input);
  }
}

@ApiTags('Statuses')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedError(404))
@ApiResponse(documentedAccessError(409))
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller('lists/:listId/resolved-statuses')
export class ListStatusesController {
  constructor(private readonly statuses: StatusesService) {}
  @Get()
  @NodePermission('container.read', 'listId')
  @ApiOperation({
    description:
      'Visible list members read the complete effective status set using the shared root-to-leaf resolver and a consistent configuration revision.',
    operationId: 'getListResolvedStatuses',
    summary: 'Resolve visible list statuses',
  })
  @ApiResponse({
    status: 200,
    type: ResolvedStatusResponseDto.Output,
    example: ResolvedStatusCollectionSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: ResolvedStatusResponseDto,
    description: 'Visible effective statuses with inheritance provenance.',
  })
  resolve(
    @Param() params: ListStatusParamsDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.statuses.resolve(request.identity, params.listId);
  }
}
