'use client';

import { SearchWorkspaceQuerySchema } from '@flowboard/contracts';
import { FormFields, useZodForm } from '@flowboard/forms';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  HeaderSearchButton,
  Stack,
  Typography,
} from '@flowboard/ui';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { z } from 'zod';

import { useTaskEditor } from '../tasks/useTaskEditor';

import { GlobalSearchResults } from './GlobalSearchResults';

import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';
import type { SearchHit } from '@flowboard/contracts';

const SearchFormSchema = z.strictObject({ q: SearchWorkspaceQuerySchema.shape.q });

export function GlobalSearch({ runtime, scope }: { runtime: ClientRuntime; scope: QueryScope }) {
  const router = useRouter();
  const openTask = useTaskEditor();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState<{ attempt: number; q: string } | null>(null);
  const { control, handleSubmit, reset } = useZodForm(SearchFormSchema, {
    defaultValues: { q: '' },
  });

  const close = () => {
    setOpen(false);
    setSubmitted(null);
    reset({ q: '' });
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
          <Stack spacing={1.6}>
            <Stack
              component="form"
              noValidate
              direction="row"
              spacing={0.8}
              sx={{ alignItems: 'flex-start' }}
              onSubmit={handleSubmit(({ q }) =>
                setSubmitted((current) => ({ q, attempt: (current?.attempt ?? 0) + 1 })),
              )}
            >
              <FormFields
                control={control}
                fields={[
                  { kind: 'text', name: 'q', label: 'Search tasks and lists', required: true },
                ]}
              />
              <Button type="submit" variant="contained">
                Search
              </Button>
            </Stack>
            {open && submitted ? (
              <GlobalSearchResults
                key={`${submitted.q}:${submitted.attempt}`}
                q={submitted.q}
                runtime={runtime}
                scope={scope}
                onSelect={select}
              />
            ) : (
              <Typography color="text.secondary">
                Find tasks and lists across your workspace. Search by word or quoted phrase.
              </Typography>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}
