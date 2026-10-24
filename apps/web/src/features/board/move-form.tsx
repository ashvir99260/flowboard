'use client';

import {
  FieldKeySchema,
  FieldValueSchema,
  selectTaskStatus,
  UuidSchema,
} from '@flowboard/contracts';
import { CustomFieldInput, FormField } from '@flowboard/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { prepareMoveFields } from './task-placement';

import type { BoardColumn } from './board-data';
import type { useTaskMutation } from './use-task-mutation';
import type { ResolvedField, ResolvedStatus, Task } from '@flowboard/contracts';
import type { ReactNode } from 'react';
import type { Control, FieldPath } from 'react-hook-form';

const DraftSchema = z.strictObject({
  statusId: UuidSchema,
  placementKind: z.enum(['start', 'end', 'before', 'after']),
  anchorId: z.string(),
  customFields: z.record(FieldKeySchema, FieldValueSchema.nullable()),
});
type Draft = z.infer<typeof DraftSchema>;

function SelectField({
  name,
  label,
  control,
  busy,
  children,
}: {
  busy: boolean;
  children: ReactNode;
  control: Control<Draft>;
  label: string;
  name: 'statusId' | 'placementKind' | 'anchorId';
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: { ref, ...input }, fieldState }) => (
        <FormField
          {...input}
          inputRef={ref}
          label={label}
          select
          slotProps={{ select: { native: true } }}
          disabled={busy}
          errorMessage={fieldState.error?.message}
        >
          {children}
        </FormField>
      )}
    />
  );
}

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
  const { control, handleSubmit, setError } = useForm<Draft>({
    resolver: zodResolver(schema),
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
      spacing={3}
    >
      {message && <Alert severity="error">{message}</Alert>}
      <SelectField name="statusId" label="Status" control={control} busy={busy}>
        <option value="">Select a status</option>
        {statuses.map((status) => (
          <option key={status.id} value={status.id}>
            {status.name}
          </option>
        ))}
      </SelectField>
      <SelectField name="placementKind" label="Placement" control={control} busy={busy}>
        <option value="start">Start of column</option>
        <option value="end">End of column</option>
        {sameList && anchors.length > 0 && (
          <>
            <option value="before">Before a loaded task</option>
            <option value="after">After a loaded task</option>
          </>
        )}
      </SelectField>
      {placementKind === 'end' && (
        <Typography color="text.secondary" variant="body2">
          A task moved to the end may appear on a later page.
        </Typography>
      )}
      {(placementKind === 'before' || placementKind === 'after') && (
        <SelectField name="anchorId" label="Anchor task" control={control} busy={busy}>
          <option value="">Choose a task</option>
          {anchors.map((anchor) => (
            <option key={anchor.id} value={anchor.id}>
              {anchor.title}
            </option>
          ))}
        </SelectField>
      )}
      {removedKeys.length > 0 && (
        <Alert severity="info">
          These fields are unavailable in the destination and will be cleared:{' '}
          {removedKeys.join(', ')}.
        </Alert>
      )}
      {fields.map((definition) => (
        <Controller
          key={definition.key}
          control={control}
          name={`customFields.${definition.key}`}
          render={({ field, fieldState }) => (
            <CustomFieldInput
              field={definition}
              disabled={busy}
              inputRef={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
      ))}
    </Stack>
  );
}
