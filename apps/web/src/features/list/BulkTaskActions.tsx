'use client';

import { Button, Dialog, DialogContent, DialogTitle, Stack, Typography } from '@flowboard/ui';
import { useState } from 'react';

import { BulkTaskEditor } from './BulkTaskEditor';

import type { BulkTaskEditorProps } from './bulkTaskEditorTypes';

export function BulkTaskActions({
  listId,
  runtime,
  scope,
  tasks,
  onSaved,
  onClear,
}: Omit<BulkTaskEditorProps, 'onClose'> & { onClear: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Stack direction="row" spacing={0.8} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography>{tasks.length} of 50 selected</Typography>
        <Button disabled={tasks.length === 0 || tasks.length > 50} onClick={() => setOpen(true)}>
          Edit selected tasks
        </Button>
        <Button disabled={tasks.length === 0} onClick={onClear}>
          Clear selection
        </Button>
      </Stack>
      <Dialog open={open} fullWidth maxWidth="sm" aria-labelledby="bulk-task-title">
        <DialogTitle id="bulk-task-title">Edit selected tasks</DialogTitle>
        <DialogContent>
          {open && (
            <BulkTaskEditor
              listId={listId}
              runtime={runtime}
              scope={scope}
              tasks={tasks}
              onSaved={onSaved}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
