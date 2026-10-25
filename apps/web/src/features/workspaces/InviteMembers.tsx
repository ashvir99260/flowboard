'use client';

import { Button, ConfirmDialog, Dialog, DialogContent, DialogTitle, Stack } from '@flowboard/ui';
import { useCallback, useState } from 'react';

import { InviteContent } from './InviteContent';

import type { InvitationContext, InvitationFormState } from './invitationTypes';

export function InviteMembers({
  open,
  onClose,
  runtime,
  scope,
}: InvitationContext & { onClose: () => void; open: boolean }) {
  const [state, setState] = useState<InvitationFormState>({ busy: false, dirty: false });
  const [confirm, setConfirm] = useState(false);
  const onState = useCallback((value: InvitationFormState) => setState(value), []);

  const close = () => {
    if (state.busy) return;

    if (state.dirty) setConfirm(true);
    else onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={close}
        closeDisabled={state.busy}
        fullWidth
        maxWidth="sm"
        aria-labelledby="invite-title"
      >
        <DialogTitle id="invite-title">Invite to workspace</DialogTitle>
        <DialogContent>
          <Stack spacing={1.6}>
            {open && <InviteContent runtime={runtime} scope={scope} onState={onState} />}
            <Button disabled={state.busy} onClick={close}>
              Close invitation
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        busy={state.busy}
        title="Discard invitation draft?"
        description="The invitation has not been created. Your email and role changes will be discarded."
        confirmLabel="Discard draft"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          setConfirm(false);
          onClose();
        }}
      />
    </>
  );
}
