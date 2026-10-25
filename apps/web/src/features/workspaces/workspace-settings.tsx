'use client';

import { WorkspaceEnvelopeSchema } from '@flowboard/contracts';
import { Alert, Button, ErrorState, Stack, Typography } from '@flowboard/ui';
import { useState } from 'react';

import { apiError } from '../../lib/api-error';
import { useSession } from '../../providers/app-providers';
import { SessionLoading } from '../auth/session-gate';
import { useRealtime } from '../realtime/realtime-provider';

import { useGetWorkspaceQuery } from './use-get-workspace-query';
import { WorkspaceForm } from './workspace-form';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { WorkspaceEnvelope } from '@flowboard/contracts';

function Settings({ runtime, scope }: { runtime: ClientRuntime; scope: QueryScope }) {
  const query = useGetWorkspaceQuery(runtime, scope);

  useRealtime(undefined, (event) => {
    if (event.kind === 'workspace' || event.kind === 'resync') void query.refetch();
  });

  const [generation, setGeneration] = useState(0);
  const [snapshot, setSnapshot] = useState<WorkspaceEnvelope | null>(null);

  const parsed = WorkspaceEnvelopeSchema.safeParse(query.data);
  const valid =
    parsed.success &&
    parsed.data.data.id === scope.workspaceId &&
    parsed.data.data.archivedAt === null;
  const failure = query.isError ? apiError(query.error) : null;

  if (!snapshot && valid) setSnapshot(parsed.data);

  if (
    failure &&
    ['FORBIDDEN', 'NOT_FOUND', 'WORKSPACE_ARCHIVED', 'MEMBERSHIP_REQUIRED'].includes(failure.code)
  )
    return <ErrorState title="Workspace unavailable" description={failure.message} />;

  if (!snapshot) {
    if (query.isPending || valid) return <SessionLoading />;

    return (
      <ErrorState
        title="Workspace unavailable"
        description={failure?.message ?? 'The workspace response is unavailable.'}
        action={
          <Button
            onClick={() => {
              void query.refetch();
            }}
          >
            Reload workspace
          </Button>
        }
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Typography component="h1" variant="h1">
        Workspace settings
      </Typography>
      {(failure || !valid) && (
        <Alert severity="warning">Workspace details could not refresh. Your draft is kept.</Alert>
      )}
      <WorkspaceForm
        key={generation}
        workspace={snapshot}
        runtime={runtime}
        scope={scope}
        onReload={async () => {
          const response = await query.refetch();
          const value = WorkspaceEnvelopeSchema.safeParse(response.data);
          if (
            !response.isError &&
            value.success &&
            value.data.data.id === scope.workspaceId &&
            value.data.data.archivedAt === null
          ) {
            setSnapshot(value.data);
            setGeneration((current) => current + 1);
          }
        }}
      />
    </Stack>
  );
}

export function WorkspaceSettings() {
  const { runtime, scope, session } = useSession();

  if (!runtime || !scope) return <SessionLoading />;

  if (session?.data.activeWorkspace?.role !== 'admin')
    return (
      <ErrorState
        description="Only workspace administrators can manage this workspace."
        title="Access denied"
      />
    );

  return <Settings key={JSON.stringify(scope)} runtime={runtime} scope={scope} />;
}
