'use client';

import {
  FieldKeySchema,
  FieldValueSchema,
  selectTaskStatus,
  UuidSchema,
} from '@flowboard/contracts';
import { ControlledField, customFieldConfig, FormFields } from '@flowboard/forms';
import { useZodForm } from '@flowboard/forms';
import { Alert, Stack, Typography } from '@flowboard/ui';
import { useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { z } from 'zod';

import { prepareMoveFields } from './task-placement';

import type { BoardColumn } from './board-data';
import type { useTaskMutation } from './use-task-mutation';
import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';
import type { FieldPath } from 'react-hook-form';

const DraftSchema = z.strictObject({
  statusId: UuidSchema,
  placementKind: z.enum(['start', 'end', 'before', 'after']),
  anchorId: z.string(),
  customFields: z.record(FieldKeySchema, FieldValueSchema.nullable()),
});
type Draft = z.infer<typeof DraftSchema>;

export function MoveForm({
  busy,
  task,
  sourceStatus,
  configVersion,
  destinationListId,
  fields,
  statuses,
  columns,
  formId,
  submit,
  onClose,
  onBusyChange,
}: {
  busy: boolean;
  columns: readonly BoardColumn[];
  configVersion: number;
  destinationListId: string;
  fields: readonly ResolvedField[];
  formId: string;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  sourceStatus: ResolvedStatus;
  statuses: readonly ResolvedStatus[];
  submit: ReturnType<typeof useTaskMutation>['submit'];
  task: Task;
}) {
  const inFlight = useRef(false);
  const [message, setMessage] = useState<string | null>(null);

  const sameList = destinationListId === task.primaryListId;
  const schema = DraftSchema.superRefine((draft, context) => {
    const prepared = prepareMoveFields(task.customFields, fields, draft.customFields);
    if (!prepared.success)
      for (const issue of prepared.issues)
        context.addIssue({ code: 'custom', message: issue.message, path: issue.path });

    if (!statuses.some((status) => status.id === draft.statusId))
      context.addIssue({
        code: 'custom',
        path: ['statusId'],
        message: 'Choose a destination status.',
      });

    if (draft.placementKind === 'before' || draft.placementKind === 'after') {
      const anchors = sameList
        ? (columns.find((column) => column.status.id === draft.statusId)?.tasks ?? [])
        : [];
      if (draft.anchorId === task.id || !anchors.some((anchor) => anchor.id === draft.anchorId))
        context.addIssue({
          code: 'custom',
          path: ['anchorId'],
          message: 'Choose a loaded task in this status.',
        });
    }
  });
  const selected = selectTaskStatus(sourceStatus, statuses);

  const { control, handleSubmit, setError } = useZodForm(schema, {
    mode: 'onBlur',
    defaultValues: {
      statusId: selected.success ? selected.statusId : '',
      placementKind: 'end',
      anchorId: '',
      customFields: Object.fromEntries(
        fields.map((field) => [field.key, task.customFields[field.key] ?? null]),
      ),
    },
  });
  const statusId = useWatch({ control, name: 'statusId' });
  const placementKind = useWatch({ control, name: 'placementKind' });
  const corrections = useWatch({ control, name: 'customFields' });

  const anchors =
    columns
      .find((column) => column.status.id === statusId)
      ?.tasks.filter((item) => item.id !== task.id) ?? [];
  const removedKeys = prepareMoveFields(task.customFields, fields, corrections).removedKeys;
  const save = async (draft: Draft) => {
    if (inFlight.current) return;

    setMessage(null);
    const prepared = prepareMoveFields(task.customFields, fields, draft.customFields);
    if (!prepared.success) return;

    const placement =
      draft.placementKind === 'before'
        ? { beforeId: draft.anchorId }
        : draft.placementKind === 'after'
          ? { afterId: draft.anchorId }
          : { edge: draft.placementKind };
    inFlight.current = true;
    onBusyChange(true);
    try {
      const result = await submit({
        taskId: task.id,
        sourceListId: task.primaryListId,
        sourceStatusId: task.statusId,
        request: {
          destinationListId,
          statusId: draft.statusId,
          expectedVersion: task.version,
          expectedConfigVersion: configVersion,
          placement,
          customFields: prepared.patch,
        },
      });
      if (result.success) onClose();
      else {
        setMessage(result.error.message);
        if ('details' in result.error)
          for (const issue of result.error.details ?? []) {
            if (issue.path[0] === 'customFields')
              setError(issue.path.join('.') as FieldPath<Draft>, { message: issue.message });
          }
      }
    } finally {
      inFlight.current = false;
      onBusyChange(false);
    }
  };

  return (
    <Stack
      component="form"
      id={formId}
      noValidate
      onSubmit={(event) => void handleSubmit(save)(event)}
      spacing={1.2}
    >
      {message && (
        <Alert aria-live="off" severity="error">
          {message}
        </Alert>
      )}
      <FormFields
        control={control}
        disabled={busy}
        fields={[
          {
            kind: 'select',
            name: 'statusId',
            label: 'Status',
            options: [
              { value: '', label: 'Select a status' },
              ...statuses.map((status) => ({ value: status.id, label: status.name })),
            ],
          },
          {
            kind: 'select',
            name: 'placementKind',
            label: 'Placement',
            options: [
              { value: 'start', label: 'Start of column' },
              { value: 'end', label: 'End of column' },
              ...(sameList && anchors.length > 0
                ? [
                    { value: 'before', label: 'Before a loaded task' },
                    { value: 'after', label: 'After a loaded task' },
                  ]
                : []),
            ],
          },
        ]}
      />
      {placementKind === 'end' && (
        <Typography color="text.secondary" variant="body2">
          A task moved to the end may appear on a later page.
        </Typography>
      )}
      {(placementKind === 'before' || placementKind === 'after') && (
        <FormFields
          control={control}
          disabled={busy}
          fields={[
            {
              kind: 'select',
              name: 'anchorId',
              label: 'Anchor task',
              options: [
                { value: '', label: 'Choose a task' },
                ...anchors.map((anchor) => ({ value: anchor.id, label: anchor.title })),
              ],
            },
          ]}
        />
      )}
      {removedKeys.length > 0 && (
        <Alert aria-live="off" severity="info">
          These fields are unavailable in the destination and will be cleared:{' '}
          {removedKeys.join(', ')}.
        </Alert>
      )}
      {fields.map((definition) => (
        <ControlledField
          key={definition.key}
          control={control}
          disabled={busy}
          config={customFieldConfig<Draft>(`customFields.${definition.key}`, definition)}
        />
      ))}
    </Stack>
  );
}
