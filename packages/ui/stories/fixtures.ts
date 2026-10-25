import { ResolvedFieldSchema, ResolvedStatusSchema, TaskSchema } from '@flowboard/contracts';

// Isolated, schema-checked examples; never request or persist application data.
const status = ResolvedStatusSchema.parse(ResolvedStatusSchema.meta()?.example);
export const statuses = [
  status,
  ResolvedStatusSchema.parse({
    ...status,
    id: '20000000-0000-4000-8000-000000000101',
    key: 'active',
    name: 'In progress',
    category: 'active',
    position: 1,
  }),
  ResolvedStatusSchema.parse({
    ...status,
    id: '20000000-0000-4000-8000-000000000102',
    key: 'done',
    name: 'Done',
    category: 'done',
    position: 2,
  }),
];

const field = ResolvedFieldSchema.parse(ResolvedFieldSchema.meta()?.example);
export const effort = ResolvedFieldSchema.parse({ ...field, name: 'Effort', key: 'effort' });

export const approved = ResolvedFieldSchema.parse({
  ...field,
  id: '20000000-0000-4000-8000-000000000110',
  name: 'Approved',
  key: 'approved',
  type: 'checkbox',
  required: true,
});

export const area = ResolvedFieldSchema.parse({
  ...field,
  id: '20000000-0000-4000-8000-000000000111',
  name: 'Area',
  key: 'area',
  type: 'single_select',
  options: [
    { color: '#334455', id: '20000000-0000-4000-8000-000000000500', label: 'Web' },
    { color: '#334455', id: '20000000-0000-4000-8000-000000000501', label: 'API' },
  ],
});

export const task = TaskSchema.parse({
  ...(TaskSchema.meta()?.example as object),
  title: 'Review component states',
  statusId: status.id,
  priority: 'high',
  customFields: { approved: false, effort: 0 },
  dueDate: '2026-12-01',
});
