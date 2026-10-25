'use client';

import { FormFields, useZodForm } from '@flowboard/forms';
import { Alert, Button, Stack, TextField, Typography } from '@flowboard/ui';
import { useEffect, useRef, useState } from 'react';

import { useNotifications } from '../notifications/useNotifications';

import { InvitationDraftSchema, invitationLink } from './invitationData';
import { useCreateWorkspaceInvitationMutation } from './useCreateWorkspaceInvitationMutation';

import type { InvitationContext, InvitationFormState } from './invitationTypes';
import type { CreateInvitation, InvitationEnvelope } from '@flowboard/contracts';

export function InvitationForm({
  runtime,
  scope,
  configVersion: initialVersion,
  onState,
  onReload,
}: InvitationContext & {
  configVersion: number;
  onReload: () => Promise<number | null>;
  onState: (state: InvitationFormState) => void;
}) {
  const [configVersion, setConfigVersion] = useState(initialVersion);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [created, setCreated] = useState<InvitationEnvelope | null>(null);
  const [link, setLink] = useState('');
  const pending = useRef(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const { submit } = useCreateWorkspaceInvitationMutation(runtime, scope);
  const notifications = useNotifications();
  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isDirty },
  } = useZodForm(InvitationDraftSchema, {
    defaultValues: { email: '', role: 'member' },
    mode: 'onBlur',
  });

  useEffect(() => onState({ busy, dirty: isDirty && !created }), [busy, created, isDirty, onState]);

  useEffect(() => {
    if (!isDirty || created) return;

    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);

    return () => window.removeEventListener('beforeunload', prevent);
  }, [created, isDirty]);

  const save = async (draft: Omit<CreateInvitation, 'expectedConfigVersion'>) => {
    if (pending.current || conflict || created) return;

    pending.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await submit({ ...draft, expectedConfigVersion: configVersion });
      if (result.success) {
        setCreated(result.response);
        setLink(invitationLink(result.response.data.token, window.location.origin));
        reset(draft);

        return;
      }

      setNotice(result.error.message);
      setConflict(
        ['CONFIG_CONFLICT', 'INVALID_RESPONSE', 'WORKSPACE_ARCHIVED'].includes(result.error.code),
      );
      if ('details' in result.error)
        for (const issue of result.error.details ?? []) {
          const name = issue.path[0];
          if (name === 'email' || name === 'role')
            setError(name, { type: 'server', message: issue.message });
        }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const reload = async () => {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    try {
      const version = await onReload();
      if (version === null) {
        setNotice('Workspace details could not reload. Your invitation draft is kept.');

        return;
      }

      setConfigVersion(version);
      setConflict(false);
      setNotice(null);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const copy = async () => {
    const report = notifications.capture();
    try {
      await navigator.clipboard.writeText(link);
      report('Invitation link copied.', 'success');
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      report('Copy is unavailable. Select and copy the invitation link.', 'info');
    }
  };

  if (created)
    return (
      <Stack spacing={1.2}>
        <Alert severity="success">Invitation created. No email has been sent.</Alert>
        <Typography>
          Share this private, single-use link with the invited person. They must sign in with the
          invited email.
        </Typography>
        <TextField
          inputRef={linkInput}
          label="Private invitation link"
          value={link}
          slotProps={{ input: { readOnly: true } }}
          fullWidth
        />
        <Typography variant="body2">
          Expires {new Date(created.data.expiresAt).toLocaleString()}.
        </Typography>
        <Button onClick={() => void copy()}>Copy invitation link</Button>
      </Stack>
    );

  return (
    <Stack
      component="form"
      aria-label="Invite member"
      noValidate
      onSubmit={(event) => void handleSubmit(save)(event)}
      aria-busy={busy}
      spacing={1.2}
    >
      <Typography>
        Create a private link to share. Flowboard does not send invitation emails.
      </Typography>
      {notice && <Alert severity="error">{notice}</Alert>}
      <FormFields
        control={control}
        disabled={busy || conflict}
        fields={[
          {
            kind: 'email',
            name: 'email',
            label: 'Email address',
            required: true,
            autoComplete: 'email',
          },
          {
            kind: 'select',
            name: 'role',
            label: 'Workspace role',
            required: true,
            options: [
              { value: 'member', label: 'Member' },
              { value: 'admin', label: 'Administrator' },
            ],
          },
        ]}
      />
      {conflict && (
        <Button disabled={busy} onClick={() => void reload()}>
          Reload workspace and keep draft
        </Button>
      )}
      <Button type="submit" variant="contained" disabled={busy || conflict}>
        {busy ? 'Creating invitation…' : 'Create invitation link'}
      </Button>
    </Stack>
  );
}
