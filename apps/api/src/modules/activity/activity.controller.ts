import { ActivityPageSchema } from '@flowboard/contracts';
import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse } from 'nestjs-zod';

import {
  documentedAccessError,
  documentedError,
} from '../../core/common/swagger/api-documentation.ts';
import { TaskPermission } from '../permissions/permission.decorator.ts';

import { ActivityQueryDto, ActivityTaskParamsDto } from './activity.request.dto.ts';
import { ActivityPageResponseDto } from './activity.response.dto.ts';
import { ActivityService } from './activity.service.ts';

import type { IdentitySession } from '@flowboard/database';

@ApiTags('Activity')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedError(404))
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller('tasks/:taskId/activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}
  @Get()
  @TaskPermission('activity.read')
  @ApiOperation({
    description:
      'Recheck current task and ancestor access, then read status changes in descending creation-time/ID order. Cursor pages retain the first-page upper watermark and original expiry.',
    operationId: 'listTaskActivity',
    summary: 'Read a page of task activity',
  })
  @ApiResponse({
    status: 200,
    type: ActivityPageResponseDto.Output,
    example: ActivityPageSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: ActivityPageResponseDto,
    description: 'Authorized status activity and cursor continuation.',
  })
  list(
    @Param() params: ActivityTaskParamsDto,
    @Query() query: ActivityQueryDto,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.activity.list(request.identity, params.taskId, query);
  }
}
