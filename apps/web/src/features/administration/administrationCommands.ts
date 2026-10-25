import {
  ContainerParentType,
  CreateNodeSchema,
  MoveNodeSchema,
  NodeSchema,
  UpsertGrantSchema,
} from '@flowboard/contracts';
import { z } from 'zod';

import { updateContainerInput } from './administrationData.ts';

import type { AdministrationSnapshot } from './administrationData';
import type { AdministrationCommand } from './useAdministrationMutation';

export type AdministrationSelection =
  | { kind: 'create' }
  | { kind: 'details'; nodeId: string }
  | { kind: 'move'; nodeId: string }
  | { kind: 'grant'; nodeId: string; userId: string };

const DraftSchema = z.strictObject({
  name: NodeSchema.shape.name,
  type: NodeSchema.shape.type,
  parentId: NodeSchema.shape.parentId,
  visibility: NodeSchema.shape.visibility,
  placement: z.enum(['start', 'end']),
  grantMode: z.enum(['none', 'allow', 'deny']),
});
export type AdministrationDraft = z.infer<typeof DraftSchema>;

export function administrationDefaults(
  selection: AdministrationSelection,
  snapshot: AdministrationSnapshot,
): AdministrationDraft {
  const node =
    'nodeId' in selection ? snapshot.nodes.find((item) => item.id === selection.nodeId) : undefined;

  return {
    name: node?.name ?? '',
    type: node?.type ?? 'space',
    parentId: node?.parentId ?? null,
    visibility: node?.visibility ?? 'public',
    placement: 'end',
    grantMode:
      selection.kind === 'grant'
        ? (snapshot.grants.find((grant) => grant.userId === selection.userId)?.mode ?? 'none')
        : 'none',
  };
}

export function administrationCommand(
  selection: AdministrationSelection,
  snapshot: AdministrationSnapshot,
  draft: AdministrationDraft,
): AdministrationCommand | null {
  const expectedConfigVersion = snapshot.configVersion;
  if (selection.kind === 'create')
    return {
      kind: 'create',
      body: CreateNodeSchema.parse({
        name: draft.name,
        type: draft.type,
        parentId: draft.parentId,
        visibility: draft.visibility,
        expectedConfigVersion,
      }),
    };

  const node = snapshot.nodes.find((item) => item.id === selection.nodeId);
  if (!node) throw new Error('The selected container is no longer available.');

  if (selection.kind === 'details') {
    const body = updateContainerInput(
      node,
      { name: draft.name, visibility: draft.visibility },
      expectedConfigVersion,
    );

    return body ? { kind: 'update', nodeId: node.id, body } : null;
  }

  if (selection.kind === 'move')
    return {
      kind: 'move',
      nodeId: node.id,
      body: MoveNodeSchema.parse({
        parentId: draft.parentId,
        placement: { edge: draft.placement },
        expectedConfigVersion,
        expectedVersion: node.version,
      }),
    };

  const previous =
    snapshot.grants.find((grant) => grant.userId === selection.userId)?.mode ?? 'none';
  if (previous === draft.grantMode) return null;

  return draft.grantMode === 'none'
    ? {
        kind: 'removeGrant',
        nodeId: node.id,
        userId: selection.userId,
        body: { expectedConfigVersion },
      }
    : {
        kind: 'grant',
        nodeId: node.id,
        body: UpsertGrantSchema.parse({
          expectedConfigVersion,
          userId: selection.userId,
          mode: draft.grantMode,
        }),
      };
}

export function administrationDraftSchema(
  selection: AdministrationSelection,
  snapshot: AdministrationSnapshot,
) {
  return DraftSchema.superRefine((draft, context) => {
    if (selection.kind === 'create' || selection.kind === 'move') {
      const requiredType = ContainerParentType[draft.type];
      const valid =
        requiredType === null
          ? selection.kind === 'create' && draft.parentId === null
          : snapshot.nodes.some((node) => node.type === requiredType && node.id === draft.parentId);
      if (!valid)
        context.addIssue({
          code: 'custom',
          path: ['parentId'],
          message: 'Choose a valid parent for this container type.',
        });
    }

    try {
      administrationCommand(selection, snapshot, draft);
    } catch (cause) {
      if (cause instanceof z.ZodError)
        for (const issue of cause.issues)
          context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      else
        context.addIssue({
          code: 'custom',
          path: ['name'],
          message: 'Reload the selected container before saving.',
        });
    }
  });
}
