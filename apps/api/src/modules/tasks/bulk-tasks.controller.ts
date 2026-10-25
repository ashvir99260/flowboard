import { BulkTaskMutationEnvelopeSchema, BulkUpdateTasksSchema } from '@flowboard/contracts';
import { Body, Controller, HttpCode, Patch, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';

import { EmptyQueryDto } from '../../core/common/dto/empty-query.dto.ts';
import {
  documentedAccessError,
  documentedError,
} from '../../core/common/swagger/api-documentation.ts';
import { ActiveWorkspacePermission } from '../permissions/permission.decorator.ts';

import { BulkUpdateTasksDto } from './bulk-tasks.request.dto.ts';
import { BulkTaskMutationResponseDto } from './bulk-tasks.response.dto.ts';
import { BulkTasksService } from './bulk-tasks.service.ts';

import type { BulkTaskMutationEnvelope } from '@flowboard/contracts';
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
@Controller('tasks')
export class BulkTasksController {
  constructor(private readonly tasks: BulkTasksService) {}

  @Patch()
  @HttpCode(200)
  @ActiveWorkspacePermission('task.write')
  @ApiOperation({
    description:
      'Apply one shared patch to at most fifty unique live tasks. Recheck every permission and version inside one workspace transaction. Any invalid or denied target rolls back the complete batch; unchanged targets produce no event.',
    operationId: 'bulkUpdateTasks',
    summary: 'Update selected tasks atomically',
  })
  @ApiBody({
    type: BulkUpdateTasksDto,
    description: 'Selected task revisions, common configuration revision and shared patch.',
    examples: {
      update: {
        summary: 'Set priority on selected tasks',
        value: BulkUpdateTasksSchema.meta()?.example,
      },
    },
  })
  @ApiResponse({
    status: 200,
    type: BulkTaskMutationResponseDto.Output,
    description: 'All resulting safe task projections, final revisions and changed identities.',
    example: BulkTaskMutationEnvelopeSchema.meta()?.example,
  })
  @ZodResponse({
    status: 200,
    type: BulkTaskMutationResponseDto,
    description: 'Atomic batch outcome in the input order; no partial success response.',
  })
  update(
    @Body() input: BulkUpdateTasksDto,
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
    @Req() request: { identity: IdentitySession },
  ): Promise<BulkTaskMutationEnvelope> {
    return this.tasks.update(request.identity, input);
  }
}
