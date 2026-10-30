'use client';

import { Button, MemberAccess, Stack, Typography } from '@flowboard/ui';

import { AdministrationForm } from './AdministrationForm';

import type { AdministrationSelection } from './administrationCommands';
import type { AdministrationSnapshot } from './administrationData';
import type { AdministrationCommand } from './useAdministrationMutation';
import type { QueryScope } from '../../lib/queryScope';
import type { ClientRuntime } from '../../providers/sessionContext';

type AdministrationEditorProps = {
  active: boolean;
  disabled: boolean;
  epoch: number;
  onCommand: (command: AdministrationCommand) => void;
  onReload: () => void;
  onSaved: (nodeId?: string) => void;
  onSelect: (selection: AdministrationSelection) => void;
  onState: (state: { busy: boolean; dirty: boolean }) => void;
  runtime: ClientRuntime;
  scope: QueryScope;
  selection: AdministrationSelection;
  snapshot: AdministrationSnapshot;
  stale: boolean;
};

export function AdministrationEditor({
  active,
  disabled,
  epoch,
  runtime,
  scope,
  selection,
  snapshot,
  stale,
  onCommand,
  onReload,
  onSaved,
  onSelect,
  onState,
}: AdministrationEditorProps) {
  const nodeId = 'nodeId' in selection ? selection.nodeId : undefined;
  const node = snapshot.nodes.find((item) => item.id === nodeId);
  const siblings = snapshot.nodes
    .filter((item) => item.parentId === node?.parentId)
    .toSorted((left, right) => left.position - right.position || left.id.localeCompare(right.id));
  const position = siblings.findIndex((item) => item.id === nodeId);
  const reorder = (direction: 'up' | 'down') => {
    const anchor = siblings[position + (direction === 'up' ? -1 : 1)];
    if (!node || !anchor) return;

    onCommand({
      kind: 'reorder',
      nodeId: node.id,
      body: {
        expectedConfigVersion: snapshot.configVersion,
        expectedVersion: node.version,
        placement: direction === 'up' ? { beforeId: anchor.id } : { afterId: anchor.id },
      },
    });
  };

  return (
    <>
      {node && <Typography color="text.secondary">{node.name}</Typography>}
      {node && (
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button
            disabled={disabled}
            onClick={() => onSelect({ kind: 'details', nodeId: node.id })}
          >
            Edit details
          </Button>
          <Button disabled={disabled || stale || position <= 0} onClick={() => reorder('up')}>
            Move container up
          </Button>
          <Button
            disabled={disabled || stale || position < 0 || position >= siblings.length - 1}
            onClick={() => reorder('down')}
          >
            Move container down
          </Button>
          {node.type !== 'space' && (
            <Button
              disabled={disabled || stale}
              onClick={() => onSelect({ kind: 'move', nodeId: node.id })}
            >
              Change parent
            </Button>
          )}
          <Button
            color="error"
            disabled={disabled || stale}
            onClick={() =>
              onCommand({
                kind: 'archive',
                nodeId: node.id,
                body: {
                  expectedConfigVersion: snapshot.configVersion,
                  expectedVersion: node.version,
                },
              })
            }
          >
            Archive container
          </Button>
        </Stack>
      )}
      <AdministrationForm
        key={epoch}
        active={active}
        snapshot={snapshot}
        selection={selection}
        runtime={runtime}
        scope={scope}
        stale={stale}
        onState={onState}
        onSaved={onSaved}
        onReload={onReload}
      />
      {node && (
        <MemberAccess
          key={node.id}
          members={snapshot.members}
          grants={snapshot.grants}
          busy={disabled}
          onEdit={(userId) => onSelect({ kind: 'grant', nodeId: node.id, userId })}
        />
      )}
    </>
  );
}
