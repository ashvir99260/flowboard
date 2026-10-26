'use client';

import { Box, Button, ErrorState } from '@flowboard/ui';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { apiError } from '../../lib/apiError';
import { useSession } from '../../providers/useSession';
import { SessionGate } from '../auth/SessionGate';
import { SessionLoading } from '../auth/SessionLoading';

import { VerifiedWorkspace } from './VerifiedWorkspace';

import type { ReactNode } from 'react';

export function WorkspaceShell({
  workspaceId,
  children,
}: {
  children: ReactNode;
  workspaceId: string;
}) {
  const { listId } = useParams<{ listId?: string }>();
  const { runtime, scope, status, switchWorkspace, session } = useSession();
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<string | null>(null);
  const target = useRef(workspaceId);

  useEffect(() => {
    target.current = workspaceId;
  }, [workspaceId]);

  useEffect(() => {
    if (!runtime || !scope || status !== 'authenticated' || scope.workspaceId === workspaceId)
      return;

    const key = `${scope.userId}:${workspaceId}`;
    if (pending.current === key) return;

    pending.current = key;
    void switchWorkspace(workspaceId).catch((cause: unknown) => {
      if (target.current === workspaceId) {
        const failure = apiError(cause);
        setError(failure.message);
      }
    });
  }, [runtime, scope, status, switchWorkspace, workspaceId]);

  if (error)
    return (
      <Box component="main" sx={{ p: 2.4 }}>
        <ErrorState
          title="Workspace unavailable"
          description={error}
          action={
            <Button component={NextLink} href="/workspaces">
              Choose workspace
            </Button>
          }
        />
      </Box>
    );

  return (
    <SessionGate>
      {session?.data.activeWorkspace?.archivedAt && scope?.workspaceId === workspaceId ? (
        <ErrorState
          title="Workspace archived"
          description="This workspace is archived. Choose a workspace to restore it or continue elsewhere."
          action={
            <Button component={NextLink} href="/workspaces">
              Choose workspace
            </Button>
          }
        />
      ) : runtime && scope?.workspaceId === workspaceId ? (
        <VerifiedWorkspace
          key={JSON.stringify(scope)}
          runtime={runtime}
          scope={scope}
          listId={listId}
        >
          {children}
        </VerifiedWorkspace>
      ) : (
        <SessionLoading layout="workspace" />
      )}
    </SessionGate>
  );
}

export { ListDetails } from './ListDetails';
