import { PermissionExamples } from '@flowboard/contracts';
import { Body, Controller, Delete, Get, HttpCode, Param, Put, Query, Req } from '@nestjs/common';
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
import { documentedAccessError } from '../../core/common/swagger/api-documentation.js';

import { NodePermission } from './permission.decorator.js';
import { PermissionService } from './permission.service.js';
import {
  GrantNodeParamsDto,
  GrantParamsDto,
  GrantVersionDto,
  PermissionPageQueryDto,
  UpsertGrantDto,
} from './permissions.request.dto.js';
import { GrantPageResponseDto, GrantResponseDto } from './permissions.response.dto.js';

import type { GrantEnvelope, GrantPage } from '@flowboard/contracts';
import type { IdentitySession } from '@flowboard/database';

@ApiTags('Permissions')
@ApiBearerAuth('access-token')
@ApiResponse(documentedAccessError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedAccessError(404))
@ApiResponse(documentedAccessError(409))
@ApiResponse(documentedAccessError(500))
@ApiResponse(documentedAccessError(503))
@Controller('nodes/:nodeId/grants')
export class GrantsController {
  constructor(private readonly permissions: PermissionService) {}
  @Get()
  @NodePermission('grant.manage')
  @ApiOperation({
    description:
      'Administrators can page explicit grants for a live container. Cursor binds caller, workspace, container, limit and configuration revision; no member profile or hidden count is returned.',
    operationId: 'listNodeGrants',
    summary: 'List container grants',
  })
  @ZodResponse({
    status: 200,
    type: GrantPageResponseDto,
    description: 'Cursor page of grants and current configuration revision.',
  })
  @ApiResponse({ status: 200, type: GrantPageResponseDto.Output, example: PermissionExamples.page })
  list(
    @Param() params: GrantNodeParamsDto,
    @Query() query: PermissionPageQueryDto,
    @Req() request: { identity: IdentitySession },
  ): Promise<GrantPage> {
    return this.permissions.listGrants(request.identity, params.nodeId, query);
  }
  @Put()
  @NodePermission('grant.manage')
  @ApiOperation({
    description:
      'Administrators may allow or deny a current workspace member on this container. Rechecks access and revision inside the locked transaction; same-value writes preserve timestamps and revisions.',
    operationId: 'upsertNodeGrant',
    summary: 'Set a container grant',
  })
  @ApiBody({
    type: UpsertGrantDto,
    description: 'Target member, grant mode and current configuration precondition.',
    examples: {
      allow: {
        summary: 'Allow a member on a private container',
        value: {
          expectedConfigVersion: 1,
          mode: 'allow',
          userId: '10000000-0000-4000-8000-000000000003',
        },
      },
    },
  })
  @ZodResponse({
    status: 200,
    type: GrantResponseDto,
    description: 'Persisted grant and current configuration revision.',
  })
  @ApiResponse({
    status: 200,
    type: GrantResponseDto.Output,
    example: { data: PermissionExamples.grant, configVersion: 2 },
  })
  upsert(
    @Param() params: GrantNodeParamsDto,
    @Body() input: UpsertGrantDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<GrantEnvelope> {
    return this.permissions.upsertGrant(request.identity, params.nodeId, input);
  }
  @Delete(':userId')
  @HttpCode(204)
  @NodePermission('grant.manage')
  @ApiOperation({
    description:
      'Administrators remove a current member grant under a configuration revision precondition. An absent grant is a no-op after resource, member and revision checks. Removal restores inherited/public visibility.',
    operationId: 'removeNodeGrant',
    summary: 'Remove a container grant',
  })
  @ApiBody({
    type: GrantVersionDto,
    description: 'Current workspace configuration revision.',
    examples: {
      remove: { summary: 'Remove the observed grant', value: { expectedConfigVersion: 2 } },
    },
  })
  @ApiNoContentResponse({ description: 'Grant removed or already absent; no response body.' })
  async remove(
    @Param() params: GrantParamsDto,
    @Body() input: GrantVersionDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<void> {
    await this.permissions.removeGrant(request.identity, params.nodeId, params.userId, input);
  }
}
