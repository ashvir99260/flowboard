import {
  CreateScopeFieldSchema,
  ExpectedConfigSchema,
  ResolvedFieldCollectionSchema,
  ScopeFieldCollectionSchema,
  ScopeFieldEnvelopeSchema,
  UpdateScopeFieldSchema,
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
  CreateScopeFieldDto,
  FieldScopeDto,
  ListFieldParamsDto,
  RemoveScopeFieldDto,
  ScopeFieldParamsDto,
  UpdateScopeFieldDto,
} from './fields.request.dto.ts';
import {
  ResolvedFieldResponseDto,
  ScopeFieldMutationResponseDto,
  ScopeFieldResponseDto,
} from './fields.response.dto.ts';
import { FieldsService } from './fields.service.ts';

import type { IdentitySession } from '@flowboard/database';

@ApiTags('Fields')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedError(404))
@ApiResponse(documentedAccessError(409))
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller('scopes/:ownerType/:ownerId/fields')
export class ScopeFieldsController {
  constructor(private readonly fields: FieldsService) {}
  @Get()
  @ScopePermission('configuration.read')
  @ApiOperation({
    description:
      'Administrators read the complete bounded local collection and verified ancestor scopes, with its snapshot configuration revision.',
    operationId: 'listScopeFields',
    summary: 'Read local field configuration',
  })
  @ApiResponse({
    status: 200,
    type: ScopeFieldResponseDto.Output,
    example: ScopeFieldCollectionSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: ScopeFieldResponseDto,
    description: 'Local rows and ancestor scope metadata.',
  })
  list(
    @Param() owner: FieldScopeDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.fields.list(request.identity, owner);
  }
  @Post()
  @ScopePermission('configuration.write')
  @ApiOperation({
    description:
      'Create a complete local definition after validating the owner, all live descendants and task values under one workspace lock.',
    operationId: 'createScopeField',
    summary: 'Create local field configuration',
  })
  @ApiBody({
    type: CreateScopeFieldDto,
    description: 'Complete definition and expected configuration revision.',
    examples: {
      define: { summary: 'Add estimate field', value: CreateScopeFieldSchema.meta()?.example },
    },
  })
  @ApiResponse({
    status: 201,
    type: ScopeFieldMutationResponseDto.Output,
    example: ScopeFieldEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 201,
    type: ScopeFieldMutationResponseDto,
    description: 'Created local configuration and committed revision.',
  })
  create(
    @Param() owner: FieldScopeDto,
    @Body(new ZodValidationPipe(CreateScopeFieldDto)) input: CreateScopeFieldDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.fields.create(request.identity, owner, input);
  }
  @Patch(':fieldId')
  @ScopePermission('configuration.write')
  @ApiOperation({
    description:
      'Patch a local definition. Omitted attributes are preserved; null is invalid. All effective descendants and live tasks must remain valid.',
    operationId: 'updateScopeField',
    summary: 'Update local field configuration',
  })
  @ApiBody({
    type: UpdateScopeFieldDto,
    description: 'Definition attributes and expected configuration revision.',
    examples: {
      rename: { summary: 'Rename local field', value: UpdateScopeFieldSchema.meta()?.example },
    },
  })
  @ApiResponse({
    status: 200,
    type: ScopeFieldMutationResponseDto.Output,
    example: ScopeFieldEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: ScopeFieldMutationResponseDto,
    description: 'Updated local row and committed revision; no-op preserves both.',
  })
  update(
    @Param() params: ScopeFieldParamsDto,
    @Body() input: UpdateScopeFieldDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    const owner = { ownerType: params.ownerType, ownerId: params.ownerId };

    return this.fields.update(request.identity, owner, params.fieldId, input);
  }
  @Delete(':fieldId')
  @HttpCode(204)
  @ScopePermission('configuration.write')
  @ApiOperation({
    description:
      'Remove a local definition only when the resulting inherited schema remains valid for all live descendant tasks.',
    operationId: 'removeScopeField',
    summary: 'Remove local field configuration',
  })
  @ApiBody({
    type: RemoveScopeFieldDto,
    description: 'Expected configuration revision for this removal.',
    examples: {
      remove: { summary: 'Remove current local row', value: ExpectedConfigSchema.meta()?.example },
    },
  })
  @ApiNoContentResponse({
    description: 'Local row removed and configuration invalidation recorded atomically.',
  })
  async remove(
    @Param() params: ScopeFieldParamsDto,
    @Body() input: RemoveScopeFieldDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<void> {
    const owner = { ownerType: params.ownerType, ownerId: params.ownerId };
    await this.fields.remove(request.identity, owner, params.fieldId, input);
  }
}

@ApiTags('Fields')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedError(404))
@ApiResponse(documentedAccessError(409))
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller('lists/:listId/resolved-fields')
export class ListFieldsController {
  constructor(private readonly fields: FieldsService) {}
  @Get()
  @NodePermission('container.read', 'listId')
  @ApiOperation({
    description:
      'Visible list members read the complete effective field set using the shared nearest-definition resolver and a consistent configuration revision.',
    operationId: 'getListResolvedFields',
    summary: 'Resolve visible list fields',
  })
  @ApiResponse({
    status: 200,
    type: ResolvedFieldResponseDto.Output,
    example: ResolvedFieldCollectionSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: ResolvedFieldResponseDto,
    description: 'Visible effective fields with inheritance provenance.',
  })
  resolve(
    @Param() params: ListFieldParamsDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.fields.resolve(request.identity, params.listId);
  }
}
