'use client';

import {
  Alert,
  Button,
  Chip,
  ErrorState,
  SettingsLayout,
  SettingsList,
  Stack,
  StatusChip,
  Toolbar,
  Typography,
  WorkspaceIcon,
} from '@flowboard/ui';
import { useEffect, useId, useRef, useState } from 'react';

import { SessionLoading } from '../../auth/SessionLoading';

import { StatusForm } from './StatusForm';
import { useStatusConfiguration } from './useStatusConfiguration';

import type { QueryScope } from '../../../lib/queryScope';
import type { ClientRuntime } from '../../../providers/sessionContext';
import type { StatusScope } from '@flowboard/contracts';

type StatusScopeConfigurationProps = {
  active: boolean;
  onState: (state: { busy: boolean; dirty: boolean }) => void;
  owner: StatusScope;
  runtime: ClientRuntime;
  scope: QueryScope;
};

export function StatusScopeConfiguration({
  active,
  owner,
  runtime,
  scope,
  onState,
}: StatusScopeConfigurationProps) {
  const { result, error, retry } = useStatusConfiguration(runtime, scope, owner);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(false);
  const focusId = useId();

  useEffect(() => {
    if (!active || !restoreFocus.current || result.state !== 'ready') return;

    const target =
      document.getElementById(origin.current?.id ?? '') ??
      document.getElementById(`${focusId}-new`);
    target?.focus();
    restoreFocus.current = false;
  }, [active, editing, focusId, result.state]);

  const open = (id: string) => {
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(id);
    setNotice(null);
  };
  const close = () => {
    setEditing(null);
    onState({ busy: false, dirty: false });
    restoreFocus.current = true;
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
      <SettingsLayout
        collection={
          <Stack component="section" aria-label="Status configuration" spacing={1.6}>
            <Toolbar.Root>
              <Typography component="h2" variant="h3">
                Statuses
              </Typography>
              <Button
                id={`${focusId}-new`}
                variant="contained"
                disabled={editing !== null}
                onClick={() => open('new')}
                startIcon={<WorkspaceIcon name="plus" />}
              >
                Add status
              </Button>
            </Toolbar.Root>
            <SettingsList.Root aria-label="Statuses">
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
                  <SettingsList.Item
                    id={`${focusId}-${identity.id}`}
                    aria-label={`Edit ${name}`}
                    itemLabel={`Status ${identity.key}`}
                    key={identity.id}
                    title={effective ? <StatusChip status={effective} /> : name}
                    description={`${identity.key} · ${identity.category}`}
                    selected={editing === identity.id}
                    disabled={editing !== null}
                    onClick={() => open(identity.id)}
                  >
                    <Stack
                      component="span"
                      direction="row"
                      spacing={0.8}
                      useFlexGap
                      sx={{ flexWrap: 'wrap' }}
                    >
                      <Chip label={local ? 'Local' : 'Inherited'} size="small" />
                      {!effective && <Chip label="Hidden" size="small" />}
                    </Stack>
                  </SettingsList.Item>
                );
              })}
            </SettingsList.Root>
          </Stack>
        }
        detail={
          editing && (
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
          )
        }
      />
    </Stack>
  );
}
