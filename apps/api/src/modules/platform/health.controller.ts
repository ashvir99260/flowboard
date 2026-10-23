import { HealthExamples } from '@flowboard/contracts';
import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';

import { PublicRoute } from '../../core/common/decorators/public.decorator.js';
import { EmptyQueryDto } from '../../core/common/dto/empty-query.dto.js';
import { ApiException } from '../../core/common/errors/api-exception.js';
import { documentedError, RequestIdHeaders } from '../../core/common/swagger/api-documentation.js';

import { DependencyProbeKey } from './dependency-probe.js';
import { LivenessResponseDto, ReadinessResponseDto } from './health.response.dto.js';

import type { DependencyProbe } from './dependency-probe.js';
import type { Liveness, Readiness } from '@flowboard/contracts';

@ApiTags('Health')
@PublicRoute('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DependencyProbeKey) private readonly probe: DependencyProbe) {}

  @Get('live')
  @ApiOperation({
    description:
      'Confirm that the API process responds to HTTP requests. This public probe does not access PostgreSQL or Redis and does not accept query parameters.',
    operationId: 'getLiveness',
    summary: 'Check process liveness',
  })
  @ApiResponse(documentedError(400))
  @ApiResponse(documentedError(500))
  @ApiResponse({
    status: 200,
    example: HealthExamples.liveness,
    type: LivenessResponseDto.Output,
    headers: RequestIdHeaders,
  })
  @ZodResponse({
    status: 200,
    description: 'The API process is alive and responding.',
    type: LivenessResponseDto,
  })
  getLiveness(
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
  ): Liveness {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({
    description:
      'Check PostgreSQL and Redis with bounded timeouts after API initialization. Returns 503 when a dependency is unavailable; use this public endpoint for service readiness.',
    operationId: 'getReadiness',
    summary: 'Check database and Redis readiness',
  })
  @ApiResponse(documentedError(400))
  @ApiResponse(documentedError(500))
  @ApiResponse(documentedError(503))
  @ApiResponse({
    status: 200,
    example: HealthExamples.readiness,
    type: ReadinessResponseDto.Output,
    headers: RequestIdHeaders,
  })
  @ZodResponse({
    status: 200,
    description: 'PostgreSQL and Redis are ready to serve requests.',
    type: ReadinessResponseDto,
  })
  async getReadiness(
    @Query(new ZodValidationPipe(EmptyQueryDto)) _query: Record<string, never>,
  ): Promise<Readiness> {
    try {
      await this.probe.check();
    } catch {
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Required dependencies unavailable');
    }

    return { status: 'ready' };
  }
}
