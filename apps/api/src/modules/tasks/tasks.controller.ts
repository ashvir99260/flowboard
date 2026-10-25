import {
  ArchiveTaskSchema,
  CreateTaskSchema,
  MoveTaskSchema,
  ReorderTaskSchema,
  TaskEnvelopeSchema,
  TaskMutationEnvelopeSchema,
  TaskPageSchema,
  UpdateTaskSchema,
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
import { NodePermission, TaskPermission } from '../permissions/permission.decorator.ts';

import {
  ArchiveTaskDto,
  CreateTaskDto,
  ListTasksQueryDto,
  MoveTaskDto,
  ReorderTaskDto,
  TaskListParamsDto,
  TaskParamsDto,
  UpdateTaskDto,
} from './tasks.request.dto.ts';
import {
  TaskMutationResponseDto,
  TaskPageResponseDto,
  TaskResponseDto,
} from './tasks.response.dto.ts';
import { TasksService } from './tasks.service.ts';

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
      'Read authorized live tasks using typed filters, including an optional visible parent task, stable sort and a cursor bound to every filter and both workspace revisions.',
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
  @Post()
  @NodePermission('task.write', 'listId')
  @ApiOperation({
    description:
      'Validate current list status, fields, visible assignments and an optional top-level parent in the same list under the workspace lock; append within the status column and record an outbox event.',
    operationId: 'createTask',
    summary: 'Create a task',
  })
  @ApiBody({
    type: CreateTaskDto,
    description: 'Task inputs and expected configuration revision.',
    examples: {
      create: { summary: 'Create a task', value: CreateTaskSchema.meta()?.example },
      subtask: {
        summary: 'Create a child in the same list',
        value: {
          ...(CreateTaskSchema.meta()?.example as object),
          parentTaskId: '10000000-0000-4000-8000-000000000100',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    type: TaskMutationResponseDto.Output,
    example: TaskMutationEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 201,
    type: TaskMutationResponseDto,
    description: 'Created task, committed revisions and changed task IDs.',
  })
  create(
    @Param() params: TaskListParamsDto,
    @Body() input: CreateTaskDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.tasks.create(request.identity, params.listId, input);
  }
}

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@ApiResponse(documentedError(400))
@ApiResponse(documentedAccessError(401))
@ApiResponse(documentedAccessError(403))
@ApiResponse(documentedError(404))
@ApiResponse(documentedAccessError(409))
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
  @Patch()
  @TaskPermission('task.write')
  @ApiOperation({
    description:
      'Patch supplied fields and revalidate the complete task, parent relation, permissions and expected revisions. Omitted values are preserved; parentTaskId null explicitly detaches. Subtasks cannot have children.',
    operationId: 'updateTask',
    summary: 'Update a task',
  })
  @ApiBody({
    type: UpdateTaskDto,
    description: 'Task patch and both expected revisions.',
    examples: {
      update: { summary: 'Rename a task', value: UpdateTaskSchema.meta()?.example },
      detach: {
        summary: 'Detach a child from its parent',
        value: { expectedConfigVersion: 1, expectedVersion: 1, parentTaskId: null },
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: TaskMutationResponseDto.Output,
    example: TaskMutationEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: TaskMutationResponseDto,
    description: 'Persisted task and revisions; no-op returns no changed IDs.',
  })
  update(
    @Param() params: TaskParamsDto,
    @Body() input: UpdateTaskDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.tasks.update(request.identity, params.taskId, input);
  }
  @Post('move')
  @HttpCode(200)
  @TaskPermission('task.write')
  @ApiOperation({
    description:
      'Validate permissions, configuration and column placement under the workspace lock; update positions and events atomically. Cross-list moves reject linked children and parents with any children, including archived references.',
    operationId: 'moveTask',
    summary: 'Move a task',
  })
  @ApiBody({
    type: MoveTaskDto,
    description: 'Placement and expected revisions, with destination fields for a move.',
    examples: { move: { summary: 'Move a task', value: MoveTaskSchema.meta()?.example } },
  })
  @ApiResponse({
    status: 200,
    type: TaskMutationResponseDto.Output,
    example: TaskMutationEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: TaskMutationResponseDto,
    description: 'Persisted task, revisions and every changed task identity.',
  })
  move(
    @Param() params: TaskParamsDto,
    @Body() input: MoveTaskDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.tasks.move(request.identity, params.taskId, input);
  }
  @Post('reorder')
  @HttpCode(200)
  @TaskPermission('task.write')
  @ApiOperation({
    description:
      'Validate permissions, configuration and column placement under the workspace lock; update all affected task positions and durable events atomically.',
    operationId: 'reorderTask',
    summary: 'Reorder a task',
  })
  @ApiBody({
    type: ReorderTaskDto,
    description: 'Placement and expected revisions, with destination fields for a move.',
    examples: { reorder: { summary: 'Reorder a task', value: ReorderTaskSchema.meta()?.example } },
  })
  @ApiResponse({
    status: 200,
    type: TaskMutationResponseDto.Output,
    example: TaskMutationEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: TaskMutationResponseDto,
    description: 'Persisted task, revisions and every changed task identity.',
  })
  reorder(
    @Param() params: TaskParamsDto,
    @Body() input: ReorderTaskDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ) {
    return this.tasks.reorder(request.identity, params.taskId, input);
  }
  @Delete()
  @HttpCode(204)
  @TaskPermission('task.write')
  @ApiOperation({
    description:
      'Soft-delete a live task and atomically record its data revision and event. A parent with live children is rejected with TASK_RELATION_IN_USE; archived child links and other retained values remain historical.',
    operationId: 'archiveTask',
    summary: 'Archive a task',
  })
  @ApiBody({
    type: ArchiveTaskDto,
    description: 'Both expected revisions for archiving.',
    examples: {
      archive: { summary: 'Archive the loaded task', value: ArchiveTaskSchema.meta()?.example },
    },
  })
  @ApiNoContentResponse({ description: 'Task archived; normal reads no longer return it.' })
  async archive(
    @Param() params: TaskParamsDto,
    @Body() input: ArchiveTaskDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<void> {
    await this.tasks.archive(request.identity, params.taskId, input);
  }
}
