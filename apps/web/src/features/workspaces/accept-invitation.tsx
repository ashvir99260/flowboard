'use client';

import { Alert, AuthPanel, Button, Stack, Typography } from '@flowboard/ui';
import NextLink from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useSession } from '../../providers/app-providers';
import { SessionLoading } from '../auth/session-gate';

import { readInvitationFragment } from './invitation-data';
import { useAcceptWorkspaceInvitation } from './use-accept-workspace-invitation';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { AcceptedInvitationEnvelope } from '@flowboard/contracts';

function AcceptAction({
  runtime,
  scope,
  token,
}: {
  runtime: ClientRuntime;
  scope: QueryScope;
  token: string;
}) {
  const { submit } = useAcceptWorkspaceInvitation(runtime, scope);
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

export function AcceptInvitation() {
  const { runtime, scope, status } = useSession();
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setToken(readInvitationFragment(window.location.hash));
  }, []);

  if (status === 'booting' || !runtime || token === undefined) return <SessionLoading />;

  return (
    <AuthPanel title="Workspace invitation">
      {!token ? (
        <Alert severity="error">
          This invitation link is incomplete or invalid. Ask the workspace administrator for a new
          link.
        </Alert>
      ) : status === 'authenticated' && scope ? (
        <AcceptAction key={JSON.stringify(scope)} runtime={runtime} scope={scope} token={token} />
      ) : (
        <Stack spacing={1.2}>
          <Typography>
            Sign in or create an account using the invited email in a separate tab, then return
            here.
          </Typography>
          <Button component={NextLink} href="/login" target="_blank" rel="noopener noreferrer">
            Sign in in a new tab
          </Button>
          <Button component={NextLink} href="/signup" target="_blank" rel="noopener noreferrer">
            Create an account in a new tab
          </Button>
          <Button onClick={() => window.location.reload()}>I have signed in</Button>
        </Stack>
      )}
    </AuthPanel>
  );
}
