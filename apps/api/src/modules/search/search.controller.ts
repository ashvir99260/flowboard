import { SearchPageSchema } from '@flowboard/contracts';
import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  documentedAccessError,
  documentedError,
} from '../../core/common/swagger/api-documentation.ts';
import { ActiveWorkspacePermission } from '../permissions/permission.decorator.ts';

import { SearchWorkspaceQueryDto } from './search.request.dto.ts';
import { SearchPageResponseDto } from './search.response.dto.ts';
import { SearchService } from './search.service.ts';

import type { IdentitySession } from '@flowboard/database';

@ApiTags('Search')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedAccessError(409))
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}
  @Get()
  @ActiveWorkspacePermission('workspace.read')
  @ApiOperation({
    description:
      'Search task titles/descriptions and list names within the active workspace. Full ancestor permissions filter results and breadcrumbs before stable cursor pagination; cursors bind the caller, query, page size and both workspace revisions.',
    operationId: 'searchWorkspace',
    summary: 'Search visible workspace tasks and lists',
  })
  @ApiResponse({
    status: 200,
    type: SearchPageResponseDto.Output,
    example: SearchPageSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: SearchPageResponseDto,
    description: 'Authorized task/list navigation results and same-snapshot revisions.',
  })
  search(@Query() query: SearchWorkspaceQueryDto, @Req() request: { identity: IdentitySession }) {
    return this.searchService.search(request.identity, query);
  }
}
