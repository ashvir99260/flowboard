'use client';

import {
  Alert,
  Button,
  Chip,
  ErrorState,
  SettingsLayout,
  SettingsList,
  Stack,
  Toolbar,
  Typography,
  WorkspaceIcon,
} from '@flowboard/ui';
import { useEffect, useId, useRef, useState } from 'react';

import { SessionLoading } from '../../auth/SessionLoading';

import { FieldForm } from './FieldForm';
import { useFieldConfiguration } from './useFieldConfiguration';

import type { ConfigurationEditorProps } from '../configurationTypes';

export function FieldScopeConfiguration({
  active,
  owner,
  runtime,
  scope,
  onState,
}: ConfigurationEditorProps) {
  const { result, error, retry } = useFieldConfiguration(runtime, scope, owner);
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

  const open = (key: string) => {
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(key);
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
        title={error?.code === 'FORBIDDEN' ? 'Access denied' : 'Field configuration unavailable'}
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
          <Stack component="section" aria-label="Field configuration" spacing={1.6}>
            <Toolbar.Root>
              <Typography component="h2" variant="h3">
                Custom fields
              </Typography>
              <Button
                id={`${focusId}-new`}
                variant="contained"
                disabled={editing !== null}
                onClick={() => open('')}
                startIcon={<WorkspaceIcon name="plus" />}
              >
                Add field
              </Button>
            </Toolbar.Root>
            <SettingsList.Root aria-label="Custom fields">
              {result.effective.map((field) => (
                <SettingsList.Item
                  id={`${focusId}-${field.key}`}
                  aria-label={`Edit ${field.name}`}
                  itemLabel={`Field ${field.key}`}
                  key={field.key}
                  title={field.name}
                  description={`${field.key} · ${field.type}${field.required ? ' · Required' : ''}`}
                  selected={editing === field.key}
                  disabled={editing !== null}
                  onClick={() => open(field.key)}
                >
                  <span>
                    <Chip label={field.isInherited ? 'Inherited' : 'Local'} size="small" />
                  </span>
                </SettingsList.Item>
              ))}
            </SettingsList.Root>
            {result.effective.length === 0 && (
              <Typography color="text.secondary">
                No custom fields at this scope. Add a field to get started.
              </Typography>
            )}
          </Stack>
        }
        detail={
          editing !== null && (
            <FieldForm
              key={editing}
              active={active}
              configuration={result}
              targetKey={editing || undefined}
              runtime={runtime}
              scope={scope}
              onState={onState}
              onClose={close}
              onReload={reload}
              onSaved={() => {
                reload();
                setNotice('Field saved.');
              }}
            />
          )
        }
      />
    </Stack>
  );
}
