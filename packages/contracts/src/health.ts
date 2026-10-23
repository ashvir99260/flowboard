import { z } from 'zod';

export const HealthQuerySchema = z.strictObject({});
export const LivenessSchema = z.strictObject({ status: z.literal('ok') });
export const ReadinessSchema = z.strictObject({ status: z.literal('ready') });
export type Liveness = z.infer<typeof LivenessSchema>;
export type Readiness = z.infer<typeof ReadinessSchema>;
