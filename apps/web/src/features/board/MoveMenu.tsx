'use client';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormField,
  Stack,
  Typography,
} from '@flowboard/ui';
import { useId, useState } from 'react';

import { useTree } from '../tree/useTree';

import { MoveForm } from './MoveForm';
import { useMoveDestination } from './useMoveDestination';

import type { BoardColumn } from './boardData';
import type { useTaskPlacementMutation } from './useTaskPlacementMutation';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { ResolvedStatus, Task } from '@flowboard/contracts';

export function MoveMenu({
  task,
  sourceStatus,
  configVersion,
  columns,
  runtime,
  scope,
  submit,
  onClose,
}: {
  columns: readonly BoardColumn[];
  configVersion: number;
  onClose: () => void;
  runtime: ClientRuntime;
  scope: QueryScope;
  sourceStatus: ResolvedStatus;
  submit: ReturnType<typeof useTaskPlacementMutation>['submit'];
  task: Task;
}) {
  const id = useId();
  const tree = useTree(runtime, scope);
  const [destinationListId, setDestinationListId] = useState(task.primaryListId);
  const [busy, setBusy] = useState(false);
  const destination = useMoveDestination(runtime, scope, destinationListId, configVersion);

  return (
    <Dialog
      open
      closeDisabled={busy}
      aria-labelledby={`${id}-title`}
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <DialogTitle id={`${id}-title`}>Move task</DialogTitle>
      <DialogContent>
        <Stack spacing={1.2} sx={{ pt: 0.4 }}>
          <Typography sx={{ overflowWrap: 'anywhere' }}>{task.title}</Typography>
          {tree.state === 'error' && (
            <Alert severity="error" action={<Button onClick={tree.retry}>Retry</Button>}>
              {tree.message}
            </Alert>
          )}
          <FormField
            label="Destination list"
            value={destinationListId}
            select
            slotProps={{ select: { native: true } }}
            disabled={busy || tree.state !== 'ready'}
            onChange={(event) => setDestinationListId(event.target.value)}
          >
            {tree.state === 'ready' ? (
              tree.nodes
                .filter((node) => node.type === 'list')
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.name}
                  </option>
                ))
            ) : (
              <option value={task.primaryListId}>Loading lists…</option>
            )}
          </FormField>
          {destination.state === 'loading' && (
            <Typography role="status">Loading destination…</Typography>
          )}
          {destination.state === 'error' && <Alert severity="error">{destination.message}</Alert>}
          {destination.state === 'ready' && (
            <MoveForm
              key={destinationListId}
              busy={busy}
              task={task}
              sourceStatus={sourceStatus}
              configVersion={configVersion}
              destinationListId={destinationListId}
              fields={destination.fields}
              statuses={destination.statuses}
              columns={columns}
              formId={`${id}-form`}
              submit={submit}
              onClose={onClose}
              onBusyChange={setBusy}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          form={`${id}-form`}
          variant="contained"
          disabled={busy || destination.state !== 'ready'}
        >
          {busy ? 'Saving…' : 'Save move'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
