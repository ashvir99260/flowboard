import { z } from 'zod';

export const HealthExamples = { liveness: { status: 'ok' }, readiness: { status: 'ready' } };
export const HealthQuerySchema = z.strictObject({}).meta({
  title: 'Empty health query',
  description: 'Health probes accept no query parameters.',
  example: {},
});
export const LivenessSchema = z
  .strictObject({
    status: z.literal('ok').meta({
      description: 'The API process can respond to requests. This does not verify dependencies.',
      example: 'ok',
      title: 'Liveness status',
    }),
  })
  .meta({
    title: 'Liveness response',
    description: 'Public API process liveness result.',
    example: HealthExamples.liveness,
  });
export const ReadinessSchema = z
  .strictObject({
    status: z.literal('ready').meta({
      description: 'PostgreSQL and Redis both responded within their bounded probe timeouts.',
      example: 'ready',
      title: 'Readiness status',
    }),
  })
  .meta({
    title: 'Readiness response',
    description: 'Public readiness result after successful dependency checks.',
    example: HealthExamples.readiness,
  });
export type Liveness = z.infer<typeof LivenessSchema>;
export type Readiness = z.infer<typeof ReadinessSchema>;
