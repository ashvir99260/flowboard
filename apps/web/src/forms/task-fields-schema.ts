import { applyTaskFieldPatch, FieldKeySchema, FieldValueSchema } from '@flowboard/contracts';
import { z } from 'zod';

import type { FieldValues, ResolvedField } from '@flowboard/contracts';

export function taskFieldsSchema(fields: readonly ResolvedField[], current: FieldValues = {}) {
  return z
    .object({ customFields: z.record(FieldKeySchema, FieldValueSchema.nullable()) })
    .superRefine(({ customFields }, context) => {
      const result = applyTaskFieldPatch({ current, fields, patch: customFields });
      if (!result.success) {
        for (const issue of result.issues) {
          context.addIssue({ code: 'custom', message: issue.message, path: issue.path });
        }
      }
    });
}

export type TaskFieldsDraft = z.infer<ReturnType<typeof taskFieldsSchema>>;
