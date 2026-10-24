import { z } from 'zod';

import { ColorSchema, NameSchema, UuidSchema } from './identifiers.js';

export const CustomFieldOptionSchema = z
  .strictObject({
    color: ColorSchema.meta({
      description: 'Six-digit hexadecimal display color.',
      example: '#334455',
      title: 'Option color',
    }),
    id: UuidSchema.overwrite((value) => value.toLowerCase()).meta({
      description: 'Stable canonical option identity used in task values.',
      example: '20000000-0000-4000-8000-000000000500',
      title: 'Option ID',
    }),
    label: NameSchema.meta({
      description: 'Display label; distinct options may share a label.',
      example: 'Platform',
      title: 'Option label',
    }),
  })
  .meta({
    title: 'Custom-field option',
    description: 'One selectable identity and its presentation.',
    example: { color: '#334455', id: '20000000-0000-4000-8000-000000000500', label: 'Platform' },
  });

export type CustomFieldOption = z.infer<typeof CustomFieldOptionSchema>;
