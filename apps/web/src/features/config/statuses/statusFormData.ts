import {
  CreateScopeStatusSchema,
  resolveStatuses,
  StatusIdentitySchema,
  StatusOverrideSchema,
  UpdateScopeStatusSchema,
} from '@flowboard/contracts';
import { z } from 'zod';

import type { CreateScopeStatus, UpdateScopeStatus } from '@flowboard/contracts';
import type { readStatusConfiguration } from './statusConfiguration';

export type StatusConfiguration = Extract<
  ReturnType<typeof readStatusConfiguration>,
  { state: 'ready' }
>;

const DraftSchema = StatusIdentitySchema.pick({ category: true, key: true }).extend(
  StatusOverrideSchema.pick({ color: true, hidden: true, name: true, position: true }).shape,
);
export type StatusDraft = z.infer<typeof DraftSchema>;

type StatusCommand =
  | { body: CreateScopeStatus; kind: 'create' }
  | { body: UpdateScopeStatus; kind: 'update'; statusId: string };
const values = ({ name, color, position, hidden }: StatusDraft) => ({
  name,
  color,
  position,
  hidden,
});

export function statusDefaults(configuration: StatusConfiguration, targetId?: string): StatusDraft {
  const identity = configuration.input.identities.find((item) => item.id === targetId);
  const local = configuration.local.find((item) => item.identity.id === targetId)?.override;

  return {
    key: identity?.key ?? '',
    category: identity?.category ?? 'not_started',
    name: local?.name ?? null,
    color: local?.color ?? null,
    position: local?.position ?? null,
    hidden: local?.hidden ?? null,
  };
}

export function statusCommand(
  configuration: StatusConfiguration,
  draft: StatusDraft,
  targetId?: string,
): StatusCommand | null {
  const normalized = DraftSchema.parse(draft);
  const expectedConfigVersion = configuration.configVersion;
  if (!targetId)
    return {
      kind: 'create',
      body: CreateScopeStatusSchema.parse({
        kind: 'define',
        key: normalized.key,
        category: normalized.category,
        name: normalized.name,
        color: normalized.color,
        position: normalized.position,
        expectedConfigVersion,
      }),
    };

  const local = configuration.local.find((item) => item.identity.id === targetId)?.override;
  if (!local)
    return {
      kind: 'create',
      body: CreateScopeStatusSchema.parse({
        ...values(normalized),
        kind: 'override',
        statusId: targetId,
        expectedConfigVersion,
      }),
    };

  const changes = Object.fromEntries(
    Object.entries(values(normalized)).filter(
      ([key, value]) => value !== local[key as keyof typeof local],
    ),
  );
  if (Object.keys(changes).length === 0) return null;

  return {
    kind: 'update',
    statusId: targetId,
    body: UpdateScopeStatusSchema.parse({ ...changes, expectedConfigVersion }),
  };
}

export function statusDraftSchema(configuration: StatusConfiguration, targetId?: string) {
  return DraftSchema.superRefine((draft, context) => {
    try {
      statusCommand(configuration, draft, targetId);
    } catch (error) {
      if (error instanceof z.ZodError)
        for (const issue of error.issues)
          context.addIssue({ code: 'custom', path: issue.path, message: issue.message });
      else throw error;
    }
  });
}

export function previewStatusEdit(
  configuration: StatusConfiguration,
  draft: StatusDraft,
  targetId?: string,
) {
  const parsed = statusDraftSchema(configuration, targetId).safeParse(draft);
  if (!parsed.success)
    return {
      success: false as const,
      issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
    };

  const input = structuredClone(configuration.input);
  const scope = input.scopes.at(-1)!;
  const local = input.overrides.find(
    (row) => row.statusId === targetId && row.ownerId === scope.ownerId,
  );
  if (local) Object.assign(local, values(draft));
  else {
    // Temporary IDs belong only to this local preview; the API assigns persisted identities.
    const ids = new Set([...input.identities, ...input.overrides].map((row) => row.id));
    const previewId = () => {
      for (let index = 1; ; index++) {
        const id = `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
        if (!ids.has(id)) {
          ids.add(id);

          return id;
        }
      }
    };
    const statusId = targetId ?? previewId();
    const audit = { createdAt: '1970-01-01T00:00:00.000Z', updatedAt: '1970-01-01T00:00:00.000Z' };
    if (!targetId)
      input.identities.push({
        ...audit,
        id: statusId,
        workspaceId: input.scopes[0]!.ownerId,
        key: draft.key,
        category: draft.category,
      });

    input.overrides.push({
      ...audit,
      ...scope,
      ...values(draft),
      id: previewId(),
      workspaceId: input.scopes[0]!.ownerId,
      statusId,
    });
  }

  return resolveStatuses(input);
}

export function previewStatusRemoval(configuration: StatusConfiguration, targetId: string) {
  const ownerId = configuration.input.scopes.at(-1)!.ownerId;

  return resolveStatuses({
    ...configuration.input,
    overrides: configuration.input.overrides.filter(
      (row) => !(row.ownerId === ownerId && row.statusId === targetId),
    ),
  });
}
