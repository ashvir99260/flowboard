'use client';

import { ConfirmDialog } from '@flowboard/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { StatusFields } from './status-fields';
import {
  previewStatusEdit,
  previewStatusRemoval,
  statusCommand,
  statusDefaults,
  statusDraftSchema,
} from './status-form-data';
import { StatusPreview } from './status-preview';
import { useStatusWrite } from './use-status-write';

import type { StatusConfiguration, StatusDraft } from './status-form-data';
import type { QueryScope } from '../../../lib/query-scope';
import type { ClientRuntime } from '../../../providers/app-providers';
import type { FormEvent } from 'react';
import type { FieldPath } from 'react-hook-form';

export function StatusForm({
  active,
  configuration,
  targetId,
  runtime,
  scope,
  onState,
  onClose,
  onSaved,
  onReload,
}: {
  active: boolean;
  configuration: StatusConfiguration;
  onClose: () => void;
  onReload: () => void;
  onSaved: () => void;
  onState: (state: { busy: boolean; dirty: boolean }) => void;
  runtime: ClientRuntime;
  scope: QueryScope;
  targetId?: string;
}) {
  const owner = configuration.input.scopes.at(-1)!;
  const { submit } = useStatusWrite(runtime, scope, owner);
  const {
    control,
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { isDirty },
  } = useForm<StatusDraft>({
    defaultValues: statusDefaults(configuration, targetId),
    resolver: zodResolver(statusDraftSchema(configuration, targetId)),
    mode: 'onBlur',
  });
  const draft = { ...statusDefaults(configuration, targetId), ...useWatch({ control }) };
  const preview = previewStatusEdit(configuration, draft, targetId);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [confirmation, setConfirmation] = useState<'close' | 'reload' | 'remove' | null>(null);
  const inFlight = useRef(false);
  const focus = useRef<FieldPath<StatusDraft> | null>(null);
  const local = configuration.local.some((item) => item.identity.id === targetId);
  const canInherit = configuration.input.overrides.some(
    (row) => row.statusId === targetId && row.ownerId !== owner.ownerId,
  );
  useEffect(() => {
    setFocus(targetId ? 'name' : 'key');
  }, [setFocus, targetId]);
  useEffect(() => onState({ busy, dirty: isDirty }), [busy, isDirty, onState]);
  useEffect(() => {
    if (!busy && focus.current) {
      setFocus(focus.current);
      focus.current = null;
    }
  }, [busy, setFocus]);
  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);

    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
  const saveCommand = async (
    command:
      | NonNullable<ReturnType<typeof statusCommand>>
      | { body: { expectedConfigVersion: number }; kind: 'remove'; statusId: string },
  ) => {
    setBusy(true);
    setNotice(null);
    focus.current = null;
    const result = await submit(command);
    if (result.success) {
      onSaved();

      return;
    }

    setNotice(result.error.message);
    setConflict(
      ['VERSION_CONFLICT', 'CONFIG_CONFLICT', 'INVALID_RESPONSE'].includes(result.error.code),
    );
    for (const issue of 'details' in result.error ? (result.error.details ?? []) : []) {
      const name = issue.path[0];
      if (['key', 'category', 'name', 'color', 'position', 'hidden'].includes(String(name))) {
        focus.current ??= name as FieldPath<StatusDraft>;
        setError(name as FieldPath<StatusDraft>, { type: 'server', message: issue.message });
      }
    }
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current || conflict || !preview.success) return;

    inFlight.current = true;
    void handleSubmit(async (value) => {
      const command = statusCommand(configuration, value, targetId);
      if (!command) {
        reset(statusDefaults(configuration, targetId));
        setNotice('No changes to save.');

        return;
      }

      await saveCommand(command);
    })(event)
      .catch(() => setNotice('The status could not be saved. Please try again.'))
      .finally(() => {
        inFlight.current = false;
        setBusy(false);
      });
  };
  const request = (action: 'close' | 'reload') => {
    if (busy) return;

    if (isDirty) setConfirmation(action);
    else if (action === 'close') onClose();
    else onReload();
  };
  const removePreview = targetId ? previewStatusRemoval(configuration, targetId) : null;

  return (
    <Stack
      component="form"
      aria-label="Status editor"
      onSubmit={save}
      noValidate
      spacing={3}
      aria-busy={busy}
    >
      <Typography component="h2" variant="h3">
        {targetId ? 'Edit status' : 'Add status'}
      </Typography>
      {notice && (
        <Alert severity={notice === 'No changes to save.' ? 'info' : 'error'}>{notice}</Alert>
      )}
      {conflict && (
        <Button onClick={() => request('reload')} disabled={busy}>
          Reload configuration
        </Button>
      )}
      <StatusFields control={control} defining={!targetId} canInherit={canInherit} busy={busy} />
      <StatusPreview
        label="Draft status preview"
        items={preview.success ? preview.items : []}
        errors={preview.success ? [] : preview.issues.map((issue) => issue.message)}
      />
      <Stack direction="row" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Button type="submit" variant="contained" disabled={busy || conflict || !preview.success}>
          {busy ? 'Saving…' : 'Save status'}
        </Button>
        <Button type="button" disabled={busy} onClick={() => request('close')}>
          Cancel editing
        </Button>
        {local && (
          <Button
            type="button"
            color="error"
            disabled={busy || conflict || !removePreview?.success}
            onClick={() => setConfirmation('remove')}
          >
            {canInherit ? 'Remove local override' : 'Delete status'}
          </Button>
        )}
      </Stack>
      {local && removePreview && !removePreview.success && (
        <Alert severity="info">
          This status cannot be removed:{' '}
          {removePreview.issues.map((issue) => issue.message).join(' ')}
        </Alert>
      )}
      <ConfirmDialog
        open={active && confirmation !== null}
        busy={busy}
        title={
          confirmation === 'remove'
            ? 'Remove local status configuration?'
            : 'Discard unsaved changes?'
        }
        description={
          confirmation === 'remove'
            ? 'This removes only the configuration at this scope. Inherited settings may become visible; tasks in use can block removal.'
            : 'Your unsaved status edits will be discarded.'
        }
        confirmLabel={
          confirmation === 'remove'
            ? 'Remove configuration'
            : confirmation === 'reload'
              ? 'Discard and reload'
              : 'Discard changes'
        }
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          const action = confirmation;
          setConfirmation(null);
          if (action === 'remove' && targetId && !inFlight.current) {
            inFlight.current = true;
            void saveCommand({
              kind: 'remove',
              statusId: targetId,
              body: { expectedConfigVersion: configuration.configVersion },
            }).finally(() => {
              inFlight.current = false;
              setBusy(false);
            });
          } else if (action === 'reload') onReload();
          else if (action === 'close') onClose();
        }}
      />
    </Stack>
  );
}
