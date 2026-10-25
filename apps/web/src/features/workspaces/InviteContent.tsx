'use client';

import { WorkspaceEnvelopeSchema } from '@flowboard/contracts';
import { Alert, Button, Stack, Typography } from '@flowboard/ui';
import { useState } from 'react';

import { apiError } from '../../lib/apiError';

import { InvitationForm } from './InvitationForm';
import { useGetWorkspaceQuery } from './useGetWorkspaceQuery';

import type { InvitationContext, InvitationFormState } from './invitationTypes';

export function InviteContent({
  runtime,
  scope,
  onState,
}: InvitationContext & { onState: (state: InvitationFormState) => void }) {
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
      <Typography aria-label="Loading invitation options" role="status">
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
