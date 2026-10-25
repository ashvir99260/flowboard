'use client';

import { Alert, Button, Stack, Typography } from '@flowboard/ui';

import { useTree } from '../tree/useTree';

import { TaskDestinationForm } from './TaskDestinationForm';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

export function TaskDestination({
  runtime,
  scope,
  onSelect,
}: {
  onSelect: (id: string) => void;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const tree = useTree(runtime, scope);

  if (tree.state === 'loading')
    return (
      <Typography aria-label="Loading destination lists" role="status">
        Loading your lists…
      </Typography>
    );

  if (tree.state === 'error')
    return (
      <Stack spacing={1.2}>
        <Alert severity="error">{tree.message}</Alert>
        <Button onClick={tree.retry}>Retry lists</Button>
      </Stack>
    );

  return <TaskDestinationForm nodes={tree.nodes} onSelect={onSelect} />;
}
