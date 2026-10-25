'use client';

import { FormFields, useZodForm } from '@flowboard/forms';
import { Alert, Button, ConfirmDialog, Stack, Typography } from '@flowboard/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useNotifications } from '../notifications/notification-provider';

import { useWorkspaceWrite } from './use-workspace-write';
import { WorkspaceDraftSchema } from './workspace-lifecycle';

import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { WorkspaceEnvelope } from '@flowboard/contracts';
import type { FormFieldConfig } from '@flowboard/forms';
import type { FormEvent } from 'react';

const fields = [
  {
    kind: 'text',
    name: 'name',
    label: 'Workspace name',
    required: true,
    autoComplete: 'organization',
  },
] satisfies FormFieldConfig<{ name: string }>[];

export function WorkspaceForm({
  workspace: initialWorkspace,
  runtime,
  scope,
  onReload,
}: {
  onReload: () => Promise<void>;
  runtime: ClientRuntime;
  scope: QueryScope;
  workspace: WorkspaceEnvelope;
}) {
  const router = useRouter();
  const [workspace] = useState(initialWorkspace);
  const { submit } = useWorkspaceWrite(runtime, scope);
  const notifications = useNotifications();
  const {
    control,
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { isDirty },
  } = useZodForm(WorkspaceDraftSchema, {
    defaultValues: { name: workspace.data.name },
    mode: 'onBlur',
  });
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<'archive' | 'reload' | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const focusName = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!busy && focusName.current) {
      setFocus('name');
      focusName.current = false;
    }
  }, [busy, setFocus]);

  useEffect(() => {
    if (!isDirty) return;

    const prevent = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', prevent);

    return () => window.removeEventListener('beforeunload', prevent);
  }, [isDirty]);

  const run = async (kind: 'rename' | 'archive', name?: string) => {
    if (pending.current || conflict) return;

    pending.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const command = {
        workspaceId: workspace.data.id,
        expectedConfigVersion: workspace.configVersion,
      };
      const result = await submit(
        kind === 'rename' ? { ...command, kind, name: name! } : { ...command, kind },
      );
      if (!mounted.current) return;

      if (!result.success) {
        setNotice(result.error.message);
        setConflict(
          ['CONFIG_CONFLICT', 'INVALID_RESPONSE', 'WORKSPACE_ARCHIVED'].includes(result.error.code),
        );
        if ('details' in result.error)
          for (const issue of result.error.details ?? []) {
            if (issue.path.join('.') === 'name') {
              setError('name', { type: 'server', message: issue.message });
              focusName.current = true;
            }
          }

        return;
      }

      await runtime.refresh();
      if (kind === 'archive') {
        if (
          runtime.getSession()?.data.user.id === scope.userId &&
          runtime.getSession()?.data.activeWorkspace?.id === workspace.data.id
        ) {
          notifications.show('Workspace archived.', 'success');
          router.push('/workspaces');
        }
      } else if (mounted.current) await onReload();
    } catch {
      if (mounted.current) {
        setNotice('The workspace changed. Reload to continue.');
        setConflict(true);
      }
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const reload = async () => {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    try {
      await onReload();
    } catch {
      if (mounted.current) setNotice('The workspace could not reload. Your draft is kept.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || conflict) return;

    void handleSubmit(async ({ name }) => {
      if (name === workspace.data.name) {
        reset({ name });
        setNotice('No changes to save.');

        return;
      }

      await run('rename', name);
    })(event);
  };

  return (
    <Stack spacing={2}>
      <Stack
        component="form"
        aria-label="Workspace settings"
        spacing={1.2}
        onSubmit={save}
        noValidate
        aria-busy={busy}
      >
        {notice && <Alert severity={conflict ? 'warning' : 'info'}>{notice}</Alert>}
        <FormFields control={control} fields={fields} disabled={busy || conflict} />
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="contained" disabled={busy || conflict}>
            Save workspace
          </Button>
          <Button
            disabled={busy}
            onClick={() => (isDirty ? setConfirmation('reload') : void reload())}
          >
            Reload workspace
          </Button>
        </Stack>
      </Stack>
      <Stack component="section" aria-label="Archive workspace" spacing={1}>
        <Typography component="h2" variant="h3">
          Archive workspace
        </Typography>
        <Typography>
          Archiving blocks access and keeps tasks, permissions and history. A workspace
          administrator can restore it later.
        </Typography>
        <Button
          color="error"
          variant="outlined"
          disabled={busy || conflict}
          onClick={() => setConfirmation('archive')}
        >
          Archive workspace
        </Button>
      </Stack>
      <ConfirmDialog
        open={confirmation !== null}
        busy={busy}
        title={confirmation === 'archive' ? 'Archive this workspace?' : 'Discard unsaved changes?'}
        description={
          confirmation === 'archive'
            ? `Archive ${workspace.data.name}? Access will stop for every member. Data is retained; unsaved drafts will be discarded.`
            : 'Reload the current workspace and discard this unsaved name?'
        }
        confirmLabel={confirmation === 'archive' ? 'Archive workspace' : 'Discard and reload'}
        onCancel={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation === 'archive') void run('archive');
          else {
            setConfirmation(null);
            void reload();
          }
        }}
      />
    </Stack>
  );
}
