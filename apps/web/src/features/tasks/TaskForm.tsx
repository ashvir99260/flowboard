'use client';

import { getTask } from '@flowboard/api-client/sdk';
import { TaskEnvelopeSchema } from '@flowboard/contracts';
import { useZodForm } from '@flowboard/forms';
import { Alert, Button, ConfirmDialog, Stack } from '@flowboard/ui';
import { useEffect, useRef, useState } from 'react';

import { useRealtime } from '../realtime/useRealtime';

import { TaskBuiltInFields } from './TaskBuiltInFields';
import { TaskCustomFields } from './TaskCustomFields';
import { createTaskInput, taskDefaults, taskDraftSchema, updateTaskInput } from './taskFormData';
import { TaskParentField } from './TaskParentField';
import { useTaskWriteMutation } from './useTaskWriteMutation';

import type { assembleTaskDetail } from './taskDetailData';
import type { TaskDraft } from './taskFormData';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { Task } from '@flowboard/contracts';
import type { FormEvent } from 'react';
import type { FieldPath } from 'react-hook-form';

type Detail = Extract<ReturnType<typeof assembleTaskDetail>, { state: 'ready' }>;

function taskNoticeProps(message: string) {
  const saved = message === 'Task saved.' || message === 'Task created.';
  const local = [
    'No changes to save.',
    'This task changed elsewhere. Your unsaved edits are preserved.',
    'Task access or connection changed. Reload to check the latest task.',
  ].includes(message);

  return {
    'aria-live': local ? 'polite' : 'off',
    role: saved ? 'status' : 'alert',
    severity: saved || message === 'No changes to save.' ? 'success' : 'error',
  } as const;
}

export function TaskForm({
  detail,
  listId,
  runtime,
  scope,
  onState,
  reload,
  onArchived,
  onPersisted,
  parentTaskId,
}: {
  detail: Detail;
  listId: string;
  onArchived: () => void;
  onPersisted: (task: Task) => void;
  onState: (state: { busy: boolean; dirty: boolean }) => void;
  parentTaskId?: string;
  reload: () => void;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const [baseline, setBaseline] = useState(detail.task);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [remoteChange, setRemoteChange] = useState(0);
  const [checkedChange, setCheckedChange] = useState(0);

  useRealtime(listId, () => {
    if (baseline) setRemoteChange((value) => value + 1);
  });

  const inFlight = useRef(false);
  const errorFocus = useRef<FieldPath<TaskDraft> | null>(null);
  const { submit } = useTaskWriteMutation(runtime, scope, detail);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { isDirty },
  } = useZodForm(taskDraftSchema(detail.fields, detail.statuses), {
    defaultValues: taskDefaults(detail.fields, detail.statuses, baseline, parentTaskId),
    mode: 'onBlur',
  });

  useEffect(() => onState({ busy, dirty: isDirty }), [busy, isDirty, onState]);

  useEffect(() => {
    if (!busy && errorFocus.current) {
      setFocus(errorFocus.current);
      errorFocus.current = null;
    }
  }, [busy, setFocus]);

  useEffect(() => {
    if (!isDirty) return;

    const confirm = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', confirm);

    return () => window.removeEventListener('beforeunload', confirm);
  }, [isDirty]);

  useEffect(() => {
    if (remoteChange <= checkedChange || busy || !baseline) return;

    let active = true;
    void getTask({ client: runtime.client, path: { taskId: baseline.id }, throwOnError: true })
      .then((response) => {
        if (!active) return;

        const current = TaskEnvelopeSchema.parse(response.data);
        if (
          current.data.version <= baseline.version &&
          current.configVersion === detail.configVersion
        ) {
          setCheckedChange(remoteChange);

          return;
        }

        if (isDirty) {
          setConflict(true);
          setNotice('This task changed elsewhere. Your unsaved edits are preserved.');
          setCheckedChange(remoteChange);
        } else reload();
      })
      .catch(() => {
        if (!active) return;

        setConflict(true);
        setNotice('Task access or connection changed. Reload to check the latest task.');
        setCheckedChange(remoteChange);
      });

    return () => {
      active = false;
    };
  }, [remoteChange, checkedChange, busy, baseline, detail.configVersion, isDirty, reload, runtime]);

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || conflict) return;

    inFlight.current = true;
    errorFocus.current = null;
    void handleSubmit(async (draft) => {
      setBusy(true);
      setNotice(null);
      setConflict(false);
      const body = baseline ? updateTaskInput(draft, baseline, detail.configVersion) : null;
      if (baseline && !body) {
        setNotice('No changes to save.');

        return;
      }

      const result =
        baseline && body
          ? await submit({ kind: 'update', taskId: baseline.id, listId, body })
          : await submit({
              kind: 'create',
              taskId: `new:${listId}`,
              listId,
              body: createTaskInput(draft, detail.configVersion),
            });
      if (result.success && result.response) {
        onPersisted(result.response.data);
        setBaseline(result.response.data);
        reset(taskDefaults(detail.fields, detail.statuses, result.response.data));
        setNotice(baseline ? 'Task saved.' : 'Task created.');

        return;
      }

      if (result.success) return;

      setNotice(result.error.message);
      setConflict(
        ['VERSION_CONFLICT', 'CONFIG_CONFLICT', 'INVALID_RESPONSE'].includes(result.error.code),
      );
      const issues = 'details' in result.error ? (result.error.details ?? []) : [];
      for (const issue of issues) {
        const [first, second] = issue.path;
        const path =
          first === 'customFields' && detail.fields.some((field) => field.key === second)
            ? `customFields.${String(second)}`
            : [
                  'title',
                  'description',
                  'statusId',
                  'priority',
                  'dueDate',
                  'assigneeIds',
                  'parentTaskId',
                ].includes(String(first))
              ? String(first)
              : null;
        if (path) {
          errorFocus.current ??= path as FieldPath<TaskDraft>;
          setError(path as FieldPath<TaskDraft>, { type: 'server', message: issue.message });
        }
      }
    })(event)
      .catch(() => setNotice('The task could not be saved. Please try again.'))
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  };
  const archive = () => {
    if (inFlight.current || !baseline || conflict) return;

    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    void submit({
      kind: 'archive',
      taskId: baseline.id,
      listId,
      body: { expectedVersion: baseline.version, expectedConfigVersion: detail.configVersion },
    })
      .then((result) => {
        if (result.success) {
          onArchived();

          return;
        }

        setArchiveOpen(false);
        setNotice(result.error.message);
        setConflict(['VERSION_CONFLICT', 'CONFIG_CONFLICT'].includes(result.error.code));
      })
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  };

  return (
    <Stack component="form" noValidate onSubmit={save} spacing={1.2} aria-busy={busy}>
      {notice && <Alert {...taskNoticeProps(notice)}>{notice}</Alert>}
      {conflict && (
        <Button disabled={busy} onClick={reload}>
          {baseline ? 'Reload latest task' : 'Close and refresh list'}
        </Button>
      )}
      <TaskBuiltInFields baseline={baseline} busy={busy} control={control} detail={detail} />
      <TaskParentField
        control={control}
        busy={busy}
        taskId={baseline?.id}
        listId={listId}
        runtime={runtime}
        scope={scope}
      />
      <TaskCustomFields fields={detail.fields} control={control} busy={busy} />
      <Button type="submit" variant="contained" disabled={busy || conflict}>
        {busy ? 'Saving…' : baseline ? 'Save changes' : 'Create task'}
      </Button>
      {baseline && (
        <Button
          type="button"
          color="error"
          disabled={busy || conflict}
          onClick={() => setArchiveOpen(true)}
        >
          Archive task
        </Button>
      )}
      <ConfirmDialog
        open={archiveOpen}
        busy={busy}
        title="Archive this task?"
        description="The task will be removed from its list. Unsaved edits will not be saved."
        confirmLabel="Archive task"
        onCancel={() => setArchiveOpen(false)}
        onConfirm={archive}
      />
    </Stack>
  );
}
