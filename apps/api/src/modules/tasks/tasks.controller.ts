import { TaskEnvelopeSchema, TaskPageSchema } from '@flowboard/contracts';
import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';

import { EmptyQueryDto } from '../../core/common/dto/empty-query.dto.js';
import {
  documentedAccessError,
  documentedError,
} from '../../core/common/swagger/api-documentation.js';
import { NodePermission, TaskPermission } from '../permissions/permission.decorator.js';

import { ListTasksQueryDto, TaskListParamsDto, TaskParamsDto } from './tasks.request.dto.js';
import { TaskPageResponseDto, TaskResponseDto } from './tasks.response.dto.js';
import { TasksService } from './tasks.service.js';

import type { IdentitySession } from '@flowboard/database';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedError(404))
@ApiResponse(documentedAccessError(409))
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller('lists/:listId/tasks')
export class ListTasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get()
  @NodePermission('task.read', 'listId')
  @ApiOperation({
    description:
      'Read authorized live tasks using typed filters, stable sort and a cursor bound to the query and both workspace revisions.',
    operationId: 'listTasks',
    summary: 'Read a page of list tasks',
  })
  @ApiResponse({
    status: 200,
    type: TaskPageResponseDto.Output,
    example: TaskPageSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: TaskPageResponseDto,
    description: 'Task page and consistent configuration/data revisions.',
  })
  list(
    @Param() params: TaskListParamsDto,
    @Query() query: ListTasksQueryDto,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.tasks.list(request.identity, params.listId, query);
  }
}

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedError(404))
@ApiResponse(documentedError(500))
@ApiResponse(documentedError(503))
@Controller('tasks/:taskId')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Get()
  @TaskPermission('task.read')
  @ApiOperation({
    description:
      'Read one live task after checking its current primary list and full ancestor permissions in the same data snapshot.',
    operationId: 'getTask',
    summary: 'Read a task',
  })
  @ApiResponse({
    status: 200,
    type: TaskResponseDto.Output,
    example: TaskEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: TaskResponseDto,
    description: 'Safe task details and same-snapshot revisions.',
  })
  detail(
    @Param() params: TaskParamsDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.tasks.detail(request.identity, params.taskId);
  }
}
