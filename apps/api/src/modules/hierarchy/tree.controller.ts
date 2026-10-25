import { TreePageSchema } from '@flowboard/contracts';
import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import { documentedAccessError } from '../../core/common/swagger/api-documentation.ts';
import { ActiveWorkspacePermission } from '../permissions/permission.decorator.ts';
import { PermissionService } from '../permissions/permission.service.ts';
import { PermissionPageQueryDto } from '../permissions/permissions.request.dto.ts';
import { TreePageResponseDto } from '../permissions/permissions.response.dto.ts';

import type { TreePage } from '@flowboard/contracts';
import type { IdentitySession } from '@flowboard/database';

@ApiTags('Hierarchy')
@ApiBearerAuth('access-token')
@ApiResponse(documentedAccessError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedAccessError(409))
@ApiResponse(documentedAccessError(500))
@ApiResponse(documentedAccessError(503))
@Controller('tree')
export class TreeController {
  constructor(private readonly permissions: PermissionService) {}
  @Get()
  @ActiveWorkspacePermission('workspace.read')
  @ApiOperation({
    description:
      'Return only authorized live nodes in depth/full ancestor path order. Follow the opaque cursor with the same limit; changed workspace revisions require restarting. Parent nodes precede children across pages.',
    operationId: 'listVisibleTree',
    summary: 'List visible hierarchy containers',
  })
  @ZodResponse({
    status: 200,
    type: TreePageResponseDto,
    description: 'Authorized containers, virtual workspace root and revisions from one snapshot.',
  })
  @ApiResponse({
    status: 200,
    type: TreePageResponseDto.Output,
    example: TreePageSchema.meta()?.example,
  })
  list(
    @Query() query: PermissionPageQueryDto,
    @Req() request: { identity: IdentitySession },
  ): Promise<TreePage> {
    return this.permissions.listTree(request.identity, query);
  }
}
