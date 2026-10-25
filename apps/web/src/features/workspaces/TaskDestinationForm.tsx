'use client';

import { NodeSchema } from '@flowboard/contracts';
import { FormFields, useZodForm } from '@flowboard/forms';
import { Button, EmptyState, Stack } from '@flowboard/ui';
import { z } from 'zod';

type ContainerNode = ReturnType<typeof NodeSchema.parse>;
const DestinationSchema = z.strictObject({ listId: NodeSchema.shape.id });
export function TaskDestinationForm({
  nodes,
  onSelect,
}: {
  nodes: readonly ContainerNode[];
  onSelect: (listId: string) => void;
}) {
  const lists = nodes.filter(({ type }) => type === 'list');

  const { control, handleSubmit } = useZodForm(DestinationSchema, {
    defaultValues: { listId: lists[0]?.id ?? '' },
  });

  const label = (node: ContainerNode) => {
    const parent = nodes.find(({ id }) => id === node.parentId);
    const space = nodes.find(({ id }) => id === parent?.parentId);

    return [space?.name, parent?.name, node.name].filter(Boolean).join(' / ');
  };

  if (!lists.length)
    return (
      <EmptyState
        description="Ask a workspace administrator to create a list or grant you access."
        title="No available lists"
      />
    );

  return (
    <Stack
      component="form"
      aria-label="Choose task list"
      noValidate
      spacing={1.2}
      onSubmit={handleSubmit(({ listId }) => {
        if (lists.some(({ id }) => id === listId)) onSelect(listId);
      })}
    >
      <FormFields
        control={control}
        fields={[
          {
            kind: 'select',
            name: 'listId',
            label: 'Destination list',
            required: true,
            options: lists.map((node) => ({ value: node.id, label: label(node) })),
          },
        ]}
      />
      <Button type="submit" variant="contained">
        Continue to task
      </Button>
    </Stack>
  );
}
