'use client';

import { Alert, AuthPanel, Button, Stack, Typography } from '@flowboard/ui';
import NextLink from 'next/link';
import { useState, useSyncExternalStore } from 'react';

import { useSession } from '../../providers/useSession';
import { SessionLoading } from '../auth/SessionLoading';

import { AcceptInvitationAction } from './AcceptInvitationAction';
import { readInvitationFragment } from './invitationData';

const readToken = () => readInvitationFragment(window.location.hash);
const serverToken = () => undefined;
const subscribeToken = (notify: () => void) => {
  window.addEventListener('hashchange', notify);

  return () => window.removeEventListener('hashchange', notify);
};

export function AcceptInvitation() {
  const { runtime, scope, status } = useSession();
  const fragmentToken = useSyncExternalStore(subscribeToken, readToken, serverToken);
  const [token, setToken] = useState(fragmentToken);

  // Keep the invitation after successful acceptance clears its URL fragment.
  if (token === undefined && fragmentToken !== undefined) setToken(fragmentToken);

  if (status === 'booting' || !runtime || token === undefined) return <SessionLoading />;

  return (
    <AuthPanel title="Workspace invitation">
      {!token ? (
        <Alert severity="error">
          This invitation link is incomplete or invalid. Ask the workspace administrator for a new
          link.
        </Alert>
      ) : status === 'authenticated' && scope ? (
        <AcceptInvitationAction
          key={JSON.stringify(scope)}
          runtime={runtime}
          scope={scope}
          token={token}
        />
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
