'use client';

import { Alert, Button, Chip, Stack, Typography } from '@flowboard/ui';
import { ErrorState } from '@flowboard/ui';
import { useRef, useState } from 'react';

import { SessionLoading } from '../../auth/session-gate';
import { ConfigurationSettings } from '../configuration-settings';

import { StatusForm } from './status-form';
import { StatusPreview } from './status-preview';
import { useStatusConfiguration } from './use-status-configuration';

import type { QueryScope } from '../../../lib/query-scope';
import type { ClientRuntime } from '../../../providers/app-providers';
import type { StatusScope } from '@flowboard/contracts';

function ScopeConfiguration({
  active,
  owner,
  runtime,
  scope,
  onState,
}: {
  active: boolean;
  onState: (state: { busy: boolean; dirty: boolean }) => void;
  owner: StatusScope;
  runtime: ClientRuntime;
  scope: QueryScope;
}) {
  const { result, error, retry } = useStatusConfiguration(runtime, scope, owner);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const open = (id: string) => {
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(id);
    setNotice(null);
  };
  const close = () => {
    setEditing(null);
    onState({ busy: false, dirty: false });
    requestAnimationFrame(() => origin.current?.isConnected && origin.current.focus());
  };
  const reload = () => {
    close();
    retry();
  };
  if (error || result.state === 'invalid' || result.state === 'stale')
    return (
      <ErrorState
        title={error?.code === 'FORBIDDEN' ? 'Access denied' : 'Status configuration unavailable'}
        description={error?.message ?? 'The configuration changed or could not be validated.'}
        action={<Button onClick={retry}>Reload configuration</Button>}
      />
    );

  if (result.state !== 'ready') return <SessionLoading />;

  return (
    <Stack spacing={1.6}>
      {notice && (
        <Alert aria-live="off" role="status" severity="success">
          {notice}
        </Alert>
      )}
      <StatusPreview items={result.effective} />
      <Stack component="section" aria-label="Status configuration" spacing={0.8}>
        <Typography component="h2" variant="h3">
          Statuses
        </Typography>
        {result.input.identities.map((identity) => {
          const effective = result.effective.find((item) => item.id === identity.id);
          const local = result.local.find((item) => item.identity.id === identity.id);
          const name =
            effective?.name ??
            result.input.overrides.findLast(
              (item) => item.statusId === identity.id && item.name !== null,
            )?.name ??
            identity.key;

          return (
            <Stack
              component="section"
              aria-label={`Status ${identity.key}`}
              key={identity.id}
              direction="row"
              spacing={0.8}
              sx={{ alignItems: 'center', flexWrap: 'wrap' }}
            >
              <Typography>{name}</Typography>
              <Chip label={local ? 'Local' : 'Inherited'} size="small" />
              {!effective && <Chip label="Hidden" size="small" />}
              <Typography variant="caption">
                {identity.key} · {identity.category}
              </Typography>
              <Button disabled={editing !== null} onClick={() => open(identity.id)}>
                Edit {name}
              </Button>
            </Stack>
          );
        })}
        <Button variant="outlined" disabled={editing !== null} onClick={() => open('new')}>
          Add status
        </Button>
      </Stack>
      {editing && (
        <StatusForm
          active={active}
          key={editing}
          configuration={result}
          targetId={editing === 'new' ? undefined : editing}
          runtime={runtime}
          scope={scope}
          onState={onState}
          onClose={close}
          onReload={reload}
          onSaved={() => {
            reload();
            setNotice('Status saved.');
          }}
        />
      )}
    </Stack>
  );
}

export function StatusSettings({ active = true }: { active?: boolean }) {
  return <ConfigurationSettings active={active} kind="status" Editor={ScopeConfiguration} />;
}
