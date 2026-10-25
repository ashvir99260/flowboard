'use client';

import { Alert, Button, Stack, Typography } from '@flowboard/ui';
import NextLink from 'next/link';
import { useRef, useState } from 'react';

import { useAcceptWorkspaceInvitationMutation } from './useAcceptWorkspaceInvitationMutation';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { AcceptedInvitationEnvelope } from '@flowboard/contracts';

export function AcceptInvitationAction({
  runtime,
  scope,
  token,
}: {
  runtime: ClientRuntime;
  scope: QueryScope;
  token: string;
}) {
  const { submit } = useAcceptWorkspaceInvitationMutation(runtime, scope);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptedInvitationEnvelope | null>(null);
  const pending = useRef(false);

  const accept = async () => {
    if (pending.current || accepted) return;

    pending.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const result = await submit(token);
      if (!result.success) {
        setMessage(result.error.message);

        return;
      }

      window.history.replaceState(window.history.state, '', window.location.pathname);
      setAccepted(result.response);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  if (accepted)
    return (
      <Stack spacing={1.2}>
        <Alert severity="success">You joined {accepted.data.name}.</Alert>
        <Button component={NextLink} href={`/w/${accepted.data.id}`} variant="contained">
          Open workspace
        </Button>
      </Stack>
    );

  return (
    <Stack spacing={1.2}>
      <Typography>
        Accept this invitation using the account whose email was invited. Your current workspace
        stays selected until you choose the new workspace.
      </Typography>
      {message && <Alert severity="error">{message}</Alert>}
      <Button disabled={busy} onClick={() => void accept()} variant="contained">
        {busy ? 'Accepting invitation…' : 'Accept invitation'}
      </Button>
      <Button component={NextLink} href="/workspaces" disabled={busy}>
        Open workspace list
      </Button>
    </Stack>
  );
}
