import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ZodResponse, ZodValidationPipe } from 'nestjs-zod';

import { ApiException } from './api-exception.js';
import { DependencyProbeKey } from './dependency-probe.js';
import {
  ErrorResponseDto,
  HealthQueryDto,
  LivenessResponseDto,
  ReadinessResponseDto,
} from './health.dto.js';
import { PublicRoute } from './public.decorator.js';

import type { DependencyProbe } from './dependency-probe.js';
import type { Liveness, Readiness } from '@flowboard/contracts';

@ApiTags('Health')
@PublicRoute('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DependencyProbeKey) private readonly probe: DependencyProbe) {}

  @Get('live')
  @ApiOperation({ operationId: 'getLiveness', summary: 'Check process liveness' })
  @ApiResponse({ status: 400, type: ErrorResponseDto.Output })
  @ApiResponse({ status: 500, type: ErrorResponseDto.Output })
  @ZodResponse({ status: 200, type: LivenessResponseDto })
  getLiveness(
    @Query(new ZodValidationPipe(HealthQueryDto)) _query: Record<string, never>,
  ): Liveness {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ operationId: 'getReadiness', summary: 'Check database and Redis readiness' })
  @ApiResponse({ status: 400, type: ErrorResponseDto.Output })
  @ApiResponse({ status: 500, type: ErrorResponseDto.Output })
  @ApiResponse({ status: 503, type: ErrorResponseDto.Output })
  @ZodResponse({ status: 200, type: ReadinessResponseDto })
  async getReadiness(
    @Query(new ZodValidationPipe(HealthQueryDto)) _query: Record<string, never>,
  ): Promise<Readiness> {
    try {
      await this.probe.check();
    } catch {
      throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Required dependencies unavailable');
    }
    return { status: 'ready' };
  }
}
