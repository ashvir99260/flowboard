'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@flowboard/ui';
import { useId, useState } from 'react';

import { MoveForm } from '../board/move-form';

import type { WorkspaceMoveSelection } from './workspace-board-data';
import type { useTaskMutation } from '../board/use-task-mutation';

export function WorkspaceMoveRepair({
  selection,
  submit,
  onClose,
}: {
  onClose: () => void;
  selection: WorkspaceMoveSelection;
  submit: ReturnType<typeof useTaskMutation>['submit'];
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const { destination, source, sourceStatus, task } = selection;

  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      aria-labelledby={`${id}-title`}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <DialogTitle id={`${id}-title`}>Complete move to {destination.list.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.2} sx={{ pt: 0.4 }}>
          <Typography>
            Review the destination status and fields before moving. Choose the placement for this
            corrected move.
          </Typography>
          <MoveForm
            busy={busy}
            task={task}
            sourceStatus={sourceStatus}
            configVersion={source.configVersion}
            destinationListId={destination.list.id}
            fields={destination.fields}
            statuses={destination.statuses}
            columns={[]}
            formId={`${id}-form`}
            submit={submit}
            onClose={onClose}
            onBusyChange={setBusy}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form={`${id}-form`} variant="contained" disabled={busy}>
          {busy ? 'Saving…' : 'Save move'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
