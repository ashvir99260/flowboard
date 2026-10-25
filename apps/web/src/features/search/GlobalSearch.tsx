'use client';

import { Dialog, DialogContent, DialogTitle, HeaderSearchButton } from '@flowboard/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { useTaskEditor } from '../tasks/useTaskEditor';

import { GlobalSearchResults } from './GlobalSearchResults';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { SearchHit } from '@flowboard/contracts';

export function GlobalSearch({ runtime, scope }: { runtime: ClientRuntime; scope: QueryScope }) {
  const router = useRouter();
  const openTask = useTaskEditor();
  const id = useId();
  const [open, setOpen] = useState(false);

  const close = () => {
    setOpen(false);
  };
  const select = (hit: SearchHit) => {
    close();
    if (hit.type === 'task' && hit.containerId) {
      requestAnimationFrame(() => openTask(hit.id, hit.containerId!));

      return;
    }

    router.push(`/w/${scope.workspaceId}/lists/${hit.id}`);
  };

  return (
    <>
      <HeaderSearchButton onClick={() => setOpen(true)} />
      <Dialog open={open} onClose={close} fullWidth maxWidth="sm" aria-labelledby={id}>
        <DialogTitle id={id}>Search workspace</DialogTitle>
        <DialogContent>
          {open && <GlobalSearchResults runtime={runtime} scope={scope} onSelect={select} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
