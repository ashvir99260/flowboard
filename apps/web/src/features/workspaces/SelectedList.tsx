'use client';

import { NodeEnvelopeSchema } from '@flowboard/contracts';
import { Button, ErrorState, Stack, Typography } from '@flowboard/ui';
import { apiError } from '../../lib/apiError';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import { SessionLoading } from '../auth/SessionLoading';
import { ListViews } from '../list/ListViews';
import { useGetNodeQuery } from '../tree/useGetNodeQuery';

export function SelectedList({
  listId,
  runtime,
  scope,
}: {
  listId: string;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const query = useGetNodeQuery({ nodeId: listId, runtime, scope });

  if (query.isPending) return <SessionLoading />;

  if (query.isError) {
    const error = apiError(query.error);

    return (
      <ErrorState
        title={error.code === 'FORBIDDEN' ? 'Access denied' : 'List unavailable'}
        description={error.message}
        action={
          <Button
            onClick={() => {
              void query.refetch();
            }}
          >
            Retry
          </Button>
        }
      />
    );
  }

  const parsed = NodeEnvelopeSchema.safeParse(query.data);
  if (
    !parsed.success ||
    parsed.data.data.id !== listId ||
    parsed.data.data.type !== 'list' ||
    parsed.data.data.workspaceId !== scope.workspaceId ||
    parsed.data.data.archivedAt !== null
  )
    return (
      <ErrorState
        description="This address does not identify an available list in this workspace."
        title="List unavailable"
      />
    );

  const list = parsed.data.data;

  return (
    <Stack spacing={1.6}>
      <Typography component="h1" variant="h1" sx={{ overflowWrap: 'anywhere' }}>
        {list.name}
      </Typography>
      <Typography color="text.secondary">
        {list.visibility === 'private' ? 'Private list' : 'Workspace list'}
      </Typography>
      <ListViews listId={listId} />
    </Stack>
  );
}
