'use client';

import { Alert, Button, Stack, Typography } from '@flowboard/ui';

import { useTaskDetail } from '../tasks/useTaskDetail';
import { BulkTaskForm } from './BulkTaskForm';

import type { BulkTaskEditorProps } from './bulkTaskEditorTypes';

export function BulkTaskEditor(props: BulkTaskEditorProps) {
  const { result, error, retry } = useTaskDetail(props.runtime, props.scope, props.listId);

  if (error || result.state === 'invalid' || result.state === 'stale')
    return (
      <Stack spacing={1.2}>
        <Alert severity="error">{error?.message ?? 'Unable to load bulk editing options.'}</Alert>
        <Button onClick={retry}>Retry options</Button>
        <Button onClick={props.onClose}>Cancel</Button>
      </Stack>
    );

  if (result.state !== 'ready')
    return (
      <Stack spacing={1.2}>
        <Typography role="status" aria-label="Loading bulk options">
          Loading editing options…
        </Typography>
        <Button onClick={props.onClose}>Cancel</Button>
      </Stack>
    );

  return <BulkTaskForm {...props} detail={result} />;
}
