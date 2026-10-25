'use client';

import { ContainerParentType } from '@flowboard/contracts';
import { FormFields, useZodForm } from '@flowboard/forms';
import { Alert, Button, Stack, Typography } from '@flowboard/ui';
import { useEffect, useRef, useState } from 'react';
import { useWatch } from 'react-hook-form';

import {
  administrationCommand,
  administrationDefaults,
  administrationDraftSchema,
} from './administration-commands';
import { containerLabel } from './administration-data';
import { useAdministrationWrite } from './use-administration-write';

import type { AdministrationDraft, AdministrationSelection } from './administration-commands';
import type { AdministrationSnapshot } from './administration-data';
import type { QueryScope } from '../../lib/query-scope';
import type { ClientRuntime } from '../../providers/app-providers';
import type { FormFieldConfig } from '@flowboard/forms';
import type { FormEvent } from 'react';
import type { FieldPath } from 'react-hook-form';

export function AdministrationForm({
  selection,
  snapshot,
  runtime,
  scope,
  stale,
  active,
  onState,
  onSaved,
  onReload,
}: {
  active: boolean;
  onReload: () => void;
  onSaved: (nodeId?: string) => void;
  onState: (value: { dirty: boolean; busy: boolean }) => void;
  runtime: ClientRuntime;
  scope: QueryScope;
  selection: AdministrationSelection;
  snapshot: AdministrationSnapshot;
  stale: boolean;
}) {
  const { submit } = useAdministrationWrite(runtime, scope);
  const {
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    setValue,
    formState: { isDirty },
  } = useZodForm(administrationDraftSchema(selection, snapshot), {
    defaultValues: administrationDefaults(selection, snapshot),
    mode: 'onBlur',
  });
  const type = useWatch({ control, name: 'type' });
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);
  const focus = useRef<FieldPath<AdministrationDraft> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => onState({ busy, dirty: isDirty }), [busy, isDirty, onState]);

  useEffect(() => {
    if (active && !busy && focus.current) {
      setFocus(focus.current);
      focus.current = null;
    }
  }, [active, busy, setFocus]);

  useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);

    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const editing = selection.kind === 'details';
  const moving = selection.kind === 'move';
  const granting = selection.kind === 'grant';
  const parents = snapshot.nodes.filter((node) => node.type === ContainerParentType[type]);
  const fields: FormFieldConfig<AdministrationDraft>[] = granting
    ? [
        {
          kind: 'select',
          name: 'grantMode',
          label: 'Explicit access',
          options: [
            { value: 'none', label: 'No explicit grant' },
            { value: 'allow', label: 'Allow' },
            { value: 'deny', label: 'Deny' },
          ],
        },
      ]
    : [
        ...(!moving
          ? [
              {
                kind: 'text' as const,
                name: 'name' as const,
                label: 'Container name',
                required: true,
              },
            ]
          : []),
        ...(selection.kind === 'create'
          ? [
              {
                kind: 'select' as const,
                name: 'type' as const,
                label: 'Container type',
                options: [
                  { value: 'space', label: 'Space' },
                  { value: 'folder', label: 'Folder' },
                  { value: 'list', label: 'List' },
                ],
              },
            ]
          : []),
        ...((selection.kind === 'create' && type !== 'space') || moving
          ? [
              {
                kind: 'select' as const,
                name: 'parentId' as const,
                label: 'Parent container',
                required: true,
                options: [
                  { value: null, label: 'Choose a parent' },
                  ...parents.map((node) => ({
                    value: node.id,
                    label: containerLabel(node, snapshot.nodes),
                  })),
                ],
              },
            ]
          : []),
        ...(moving
          ? [
              {
                kind: 'select' as const,
                name: 'placement' as const,
                label: 'Destination position',
                options: [
                  { value: 'start', label: 'First' },
                  { value: 'end', label: 'Last' },
                ],
              },
            ]
          : [
              {
                kind: 'select' as const,
                name: 'visibility' as const,
                label: 'Visibility',
                options: [
                  { value: 'public', label: 'Public to workspace members' },
                  { value: 'private', label: 'Private: explicit allow required' },
                ],
              },
            ]),
      ];
  const member = granting
    ? snapshot.members.find((item) => item.userId === selection.userId)
    : undefined;
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current || conflict || stale) return;

    pending.current = true;
    void handleSubmit(async (draft) => {
      if (!mounted.current) return;

      const command = administrationCommand(selection, snapshot, draft);
      if (!command) {
        reset(draft);
        setNotice('No changes to save.');

        return;
      }

      setBusy(true);
      setNotice(null);
      const result = await submit(command);
      if (!mounted.current) return;

      if (result.success) {
        onSaved(result.response?.data.id);
        return;
      }

      setNotice(result.error.message);
      setConflict(
        ['VERSION_CONFLICT', 'CONFIG_CONFLICT', 'INVALID_RESPONSE'].includes(result.error.code),
      );
      for (const issue of 'details' in result.error ? (result.error.details ?? []) : []) {
        const field = issue.path[0] === 'mode' ? 'grantMode' : String(issue.path[0]);
        if (['name', 'type', 'parentId', 'visibility', 'grantMode', 'placement'].includes(field)) {
          setError(field as FieldPath<AdministrationDraft>, {
            type: 'server',
            message: issue.message,
          });
          focus.current ??= field as FieldPath<AdministrationDraft>;
        }
      }
    })(event)
      .catch(() => {
        if (mounted.current) setNotice('The change could not be saved. Your draft is kept.');
      })
      .finally(() => {
        pending.current = false;
        if (mounted.current) setBusy(false);
      });
  };

  return (
    <Stack
      component="form"
      aria-label="Administration editor"
      noValidate
      spacing={1.2}
      onSubmit={save}
      aria-busy={busy}
    >
      <Typography component="h2" variant="h3">
        {granting
          ? `Access for ${member?.name ?? 'member'}`
          : moving
            ? 'Move container'
            : editing
              ? 'Edit container'
              : 'Create container'}
      </Typography>
      {member?.role === 'admin' && (
        <Alert severity="info">
          Administrators bypass container grants. This grant does not restrict administrator access.
        </Alert>
      )}
      {notice && (
        <Alert severity={notice === 'No changes to save.' ? 'info' : 'error'}>{notice}</Alert>
      )}
      {(stale || conflict) && (
        <Alert severity="warning">
          Configuration changed. Your draft is kept; reload before saving.
        </Alert>
      )}
      <FormFields
        control={control}
        fields={fields}
        disabled={busy || stale || conflict}
        onValueChange={(name, value) => {
          if (name === 'type') {
            const parentType = ContainerParentType[value as AdministrationDraft['type']];
            setValue(
              'parentId',
              parentType === null
                ? null
                : (snapshot.nodes.find((node) => node.type === parentType)?.id ?? null),
              { shouldDirty: true, shouldValidate: true },
            );
          }
        }}
      />
      <Stack direction="row" spacing={1}>
        <Button type="submit" variant="contained" disabled={busy || stale || conflict}>
          {busy
            ? 'Saving…'
            : granting
              ? 'Save access'
              : moving
                ? 'Move container'
                : editing
                  ? 'Save container'
                  : 'Create container'}
        </Button>
        <Button disabled={busy} onClick={onReload}>
          Reload administration
        </Button>
      </Stack>
    </Stack>
  );
}
