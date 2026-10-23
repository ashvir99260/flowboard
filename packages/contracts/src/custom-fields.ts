import { z } from 'zod';

import { ColorSchema, NameSchema, UuidSchema } from './identifiers.js';

export const CustomFieldOptionSchema = z.strictObject({
  color: ColorSchema,
  id: UuidSchema,
  label: NameSchema,
});
export type CustomFieldOption = z.infer<typeof CustomFieldOptionSchema>;
