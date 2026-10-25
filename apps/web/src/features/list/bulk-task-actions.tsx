'use client';

import { ControlledField, customFieldConfig, FormFields, useZodForm } from '@flowboard/forms';
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@flowboard/ui';
import { PrioritySchema } from '@flowboard/contracts';
import { useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';

import { useTaskDetail } from '../tasks/use-task-detail';

import { bulkTaskDefaults, bulkTaskDraftSchema, bulkTaskInput } from './bulk-task-data';
import { useBulkUpdateTasks } from './use-bulk-update-tasks';

import type { BulkTaskDraft } from './bulk-task-data';
import type { assembleTaskDetail } from '../tasks/task-detail-data';
import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { Task } from '@flowboard/contracts';
import type { FormFieldConfig } from '@flowboard/forms';
import type { FieldPath } from 'react-hook-form';

type Detail = Extract<ReturnType<typeof assembleTaskDetail>, { state: 'ready' }>;
type EditorProps = {
  listId: string;
  onClose: () => void;
  onSaved: () => void;
  runtime: ClientRuntime;
  scope: QueryScope;
  tasks: readonly Task[];
};

function BulkTaskForm({
  detail,
  listId,
  onClose,
  onSaved,
  runtime,
  scope,
  tasks,
}: EditorProps & { detail: Detail }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const inFlight = useRef(false);
  const { submit } = useBulkUpdateTasks(runtime, scope, detail);
  const { control, handleSubmit, setError } = useZodForm(
    bulkTaskDraftSchema(detail.fields, detail.statuses, tasks),
    { defaultValues: bulkTaskDefaults(detail.fields, detail.statuses), mode: 'onBlur' },
  );
  const operation = useWatch({ control, name: 'operation' });
  const fieldKey = useWatch({ control, name: 'fieldKey' });
  const field = detail.fields.find(({ key }) => key === fieldKey);
  const fields: Record<
    'status' | 'priority' | 'assignees' | 'custom-field',
    FormFieldConfig<BulkTaskDraft>[]
  > = {
    status: [
      {
        kind: 'select',
        name: 'statusId',
        label: 'Status for selected tasks',
        required: true,
        options: detail.statuses.map(({ id, name }) => ({ value: id, label: name })),
      },
    ],
    priority: [
      {
        kind: 'select',
        name: 'priority',
        label: 'Priority for selected tasks',
        options: PrioritySchema.options.map((value) => ({ value, label: value })),
      },
    ],
    assignees: [
      {
        kind: 'multi_select',
        name: 'assigneeIds',
        label: 'Assignees for selected tasks',
        hint: 'Replaces all assignees. Leave empty to clear.',
        options: detail.members.map(({ userId, name }) => ({ value: userId, label: name })),
      },
    ],
    'custom-field': [
      {
        kind: 'select',
        name: 'fieldKey',
        label: 'Custom field to update',
        required: true,
        options: detail.fields.map(({ key, name }) => ({ value: key, label: name })),
      },
    ],
  };

  const save = handleSubmit(async (draft) => {
    if (inFlight.current || conflict) return;

    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await submit({
        body: bulkTaskInput(draft, tasks, detail.configVersion),
        listId,
        tasks,
      });
      if (result.success) {
        onSaved();
        onClose();

        return;
      }

      setNotice(result.error.message);
      setConflict(
        ['VERSION_CONFLICT', 'CONFIG_CONFLICT', 'INVALID_RESPONSE'].includes(result.error.code),
      );
      const issues = 'details' in result.error ? result.error.details : [];
      for (const issue of issues ?? []) {
        const customIndex = issue.path.indexOf('customFields');
        const key = issue.path[customIndex + 1];
        const name =
          customIndex >= 0 &&
          typeof key === 'string' &&
          detail.fields.some((item) => item.key === key)
            ? `customFields.${key}`
            : issue.path.find((item) =>
                ['statusId', 'assigneeIds', 'priority'].includes(String(item)),
              );
        if (name)
          setError(
            name as FieldPath<BulkTaskDraft>,
            { type: 'server', message: issue.message },
            { shouldFocus: true },
          );
      }
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  });

  return (
    <Stack
      component="form"
      noValidate
      aria-label="Bulk task editor"
      aria-busy={busy}
      onSubmit={save}
      spacing={1.2}
    >
      <Typography>{tasks.length} selected tasks. All changes are applied together.</Typography>
      {notice && <Alert severity="error">{notice}</Alert>}
      {conflict && (
        <Alert severity="warning">
          Close this editor, clear the selection, refresh, and select the tasks again. Your
          selection has been preserved.
        </Alert>
      )}
      <FormFields
        control={control}
        disabled={busy || conflict}
        fields={[
          {
            kind: 'select',
            name: 'operation',
            label: 'Change',
            options: [
              { value: 'status', label: 'Status' },
              { value: 'priority', label: 'Priority' },
              { value: 'assignees', label: 'Assignees' },
              { value: 'custom-field', label: 'Custom field' },
            ],
          },
        ]}
      />
      <FormFields control={control} disabled={busy || conflict} fields={fields[operation]} />
      {operation === 'custom-field' && field && (
        <ControlledField
          control={control}
          disabled={busy || conflict}
          config={{
            ...customFieldConfig<BulkTaskDraft>(`customFields.${field.key}`, field),
            clearable: !field.required,
          }}
        />
      )}
      <Stack direction="row" spacing={0.8}>
        <Button
          type="submit"
          variant="contained"
          disabled={busy || conflict || (operation === 'custom-field' && !field)}
        >
          {busy ? 'Updating…' : 'Update selected tasks'}
        </Button>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
      </Stack>
    </Stack>
  );
}

function BulkTaskEditor(props: EditorProps) {
  const { result, error, retry } = useTaskDetail(props.runtime, props.scope, props.listId);

  if (error || result.state === 'invalid' || result.state === 'stale')
    return (
      <Stack spacing={1.2}>
        <Alert severity="error">{error?.message ?? 'Unable to load bulk editing options.'}</Alert>
        <Button onClick={retry}>Retry options</Button>
        <Button onClick={props.onClose}>Cancel</Button>
      </Stack>
    );

  if (result.state !== 'ready')
    return (
      <Stack spacing={1.2}>
        <Typography role="status" aria-label="Loading bulk options">
          Loading editing options…
        </Typography>
        <Button onClick={props.onClose}>Cancel</Button>
      </Stack>
    );

  return <BulkTaskForm {...props} detail={result} />;
}

export function BulkTaskActions({
  listId,
  runtime,
  scope,
  tasks,
  onSaved,
  onClear,
}: Omit<EditorProps, 'onClose'> & { onClear: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography>{tasks.length} of 50 selected</Typography>
        <Button disabled={tasks.length === 0 || tasks.length > 50} onClick={() => setOpen(true)}>
          Edit selected tasks
        </Button>
        <Button disabled={tasks.length === 0} onClick={onClear}>
          Clear selection
        </Button>
      </Stack>
      <Dialog open={open} fullWidth maxWidth="sm" aria-labelledby="bulk-task-title">
        <DialogTitle id="bulk-task-title">Edit selected tasks</DialogTitle>
        <DialogContent>
          {open && (
            <BulkTaskEditor
              listId={listId}
              runtime={runtime}
              scope={scope}
              tasks={tasks}
              onSaved={onSaved}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
