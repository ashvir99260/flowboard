'use client';

import { Alert, Button, Chip, Stack, Typography } from '@flowboard/ui';
import { ErrorState } from '@flowboard/ui';
import { useRef, useState } from 'react';

import { SessionLoading } from '../../auth/session-gate';
import { ConfigurationSettings } from '../configuration-settings';

import { FieldForm } from './field-form';
import { FieldPreview } from './field-preview';
import { useFieldConfiguration } from './use-field-configuration';

import type { ConfigurationEditorProps } from '../configuration-settings';

function ScopeConfiguration({ active, owner, runtime, scope, onState }: ConfigurationEditorProps) {
  const { result, error, retry } = useFieldConfiguration(runtime, scope, owner);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const open = (key: string) => {
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditing(key);
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
        title={error?.code === 'FORBIDDEN' ? 'Access denied' : 'Field configuration unavailable'}
        description={error?.message ?? 'The configuration changed or could not be validated.'}
        action={<Button onClick={retry}>Reload configuration</Button>}
      />
    );

  if (result.state !== 'ready') return <SessionLoading />;

  return (
    <Stack spacing={1.6}>
      {notice && (
        <Alert role="status" severity="success">
          {notice}
        </Alert>
      )}
      <FieldPreview items={result.effective} />
      <Stack component="section" aria-label="Field configuration" spacing={0.8}>
        <Typography component="h2" variant="h3">
          Fields
        </Typography>
        {result.effective.map((field) => (
          <Stack
            component="section"
            aria-label={`Field ${field.key}`}
            key={field.key}
            direction="row"
            spacing={0.8}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
          >
            <Typography>{field.name}</Typography>
            <Chip label={field.isInherited ? 'Inherited' : 'Local'} size="small" />
            <Typography variant="caption">
              {field.key} · {field.type}
              {field.required ? ' · Required' : ''}
            </Typography>
            <Button disabled={editing !== null} onClick={() => open(field.key)}>
              Edit {field.name}
            </Button>
          </Stack>
        ))}
        <Button variant="outlined" disabled={editing !== null} onClick={() => open('')}>
          Add field
        </Button>
      </Stack>
      {editing !== null && (
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
      )}
    </Stack>
  );
}

export function FieldSettings({ active = true }: { active?: boolean }) {
  return <ConfigurationSettings active={active} kind="field" Editor={ScopeConfiguration} />;
}
