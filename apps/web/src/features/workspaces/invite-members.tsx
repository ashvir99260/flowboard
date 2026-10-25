'use client';

import { WorkspaceEnvelopeSchema } from '@flowboard/contracts';
import { FormFields, useZodForm } from '@flowboard/forms';
import {
  Alert,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@flowboard/ui';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiError } from '../../lib/api-error';
import { useNotifications } from '../notifications/notification-provider';

import { InvitationDraftSchema, invitationLink } from './invitation-data';
import { useCreateWorkspaceInvitation } from './use-create-workspace-invitation';
import { useGetWorkspaceQuery } from './use-get-workspace-query';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { InvitationEnvelope } from '@flowboard/contracts';

type FormState = { busy: boolean; dirty: boolean };
type InviteProps = { runtime: ClientRuntime; scope: QueryScope };

function InvitationForm({
  runtime,
  scope,
  configVersion: initialVersion,
  onState,
  onReload,
}: InviteProps & {
  configVersion: number;
  onReload: () => Promise<number | null>;
  onState: (state: FormState) => void;
}) {
  const [configVersion, setConfigVersion] = useState(initialVersion);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [created, setCreated] = useState<InvitationEnvelope | null>(null);
  const [link, setLink] = useState('');
  const pending = useRef(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const { submit } = useCreateWorkspaceInvitation(runtime, scope);
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

  const save = handleSubmit(async (draft) => {
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
  });
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
      onSubmit={save}
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

function InviteContent({
  runtime,
  scope,
  onState,
}: InviteProps & { onState: (state: FormState) => void }) {
  const query = useGetWorkspaceQuery(runtime, scope);
  const [initialVersion, setInitialVersion] = useState<number | null>(null);
  const parsed = WorkspaceEnvelopeSchema.safeParse(query.data);
  const valid =
    parsed.success &&
    parsed.data.data.id === scope.workspaceId &&
    parsed.data.data.archivedAt === null;
  if (valid && initialVersion === null) setInitialVersion(parsed.data.configVersion);

  if (initialVersion === null && query.isPending)
    return (
      <Typography role="status" aria-label="Loading invitation options">
        Loading workspace…
      </Typography>
    );

  if (initialVersion === null)
    return (
      <Stack spacing={1.2}>
        <Alert severity="error">
          {query.isError ? apiError(query.error).message : 'Workspace details are unavailable.'}
        </Alert>
        <Button onClick={() => void query.refetch()}>Retry workspace</Button>
      </Stack>
    );

  return (
    <>
      <InvitationForm
        runtime={runtime}
        scope={scope}
        configVersion={initialVersion}
        onState={onState}
        onReload={async () => {
          const next = await query.refetch();
          const value = WorkspaceEnvelopeSchema.safeParse(next.data);

          return !next.isError &&
            value.success &&
            value.data.data.id === scope.workspaceId &&
            value.data.data.archivedAt === null
            ? value.data.configVersion
            : null;
        }}
      />
      {(query.isError || !valid) && (
        <Alert severity="warning">
          Workspace details could not refresh. Your invitation draft is kept.
        </Alert>
      )}
    </>
  );
}

export function InviteMembers({
  open,
  onClose,
  runtime,
  scope,
}: InviteProps & { onClose: () => void; open: boolean }) {
  const [state, setState] = useState<FormState>({ busy: false, dirty: false });
  const [confirm, setConfirm] = useState(false);
  const onState = useCallback((value: FormState) => setState(value), []);
  const close = () => {
    if (state.busy) return;

    if (state.dirty) setConfirm(true);
    else onClose();
  };

  useEffect(() => {
    if (!open) {
      setState({ busy: false, dirty: false });
      setConfirm(false);
    }
  }, [open]);

  return (
    <>
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby="invite-title">
        <DialogTitle id="invite-title">Invite to workspace</DialogTitle>
        <DialogContent>
          <Stack spacing={1.6}>
            {open && <InviteContent runtime={runtime} scope={scope} onState={onState} />}
            <Button disabled={state.busy} onClick={close}>
              Close invitation
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        busy={state.busy}
        title="Discard invitation draft?"
        description="The invitation has not been created. Your email and role changes will be discarded."
        confirmLabel="Discard draft"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onClose();
        }}
      />
    </>
  );
}
